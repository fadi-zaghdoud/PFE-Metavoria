// Table de vérité du contexte de requête (Chantier 2, Étape A2).
// Runtime de test intégré (node:test), aucune dépendance ; module PUR → aucun I/O ni DB.
// Lancer : node --import tsx --test src/utils/contexteRequete.test.ts
//
// Ce que ces tests garantissent, et qui EST le contrat du module :
//   1. hors requête, tout vaut `undefined` — jamais d'exception, jamais de valeur inventée ;
//   2. le contexte SURVIT aux frontières asynchrones (c'est tout son intérêt) ;
//   3. deux contextes concurrents ne se mélangent pas ;
//   4. `executerSansContexte` coupe réellement l'héritage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contexteCourant,
  enrichirContexte,
  executerAvecContexte,
  executerSansContexte,
} from './contexteRequete';

const attendre = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ── Hors requête ─────────────────────────────────────────────────────────────

test('hors requête — tout vaut undefined, sans lever', () => {
  const c = contexteCourant();
  assert.equal(c.ip, undefined);
  assert.equal(c.userAgent, undefined);
  assert.equal(c.acteurId, undefined);
  assert.equal(c.acteurNom, undefined);
});

test('hors requête — contexteCourant ne renvoie jamais undefined', () => {
  assert.doesNotThrow(() => contexteCourant());
  assert.notEqual(contexteCourant(), undefined);
});

test('hors requête — enrichirContexte est sans effet, pas une erreur', () => {
  assert.doesNotThrow(() => enrichirContexte({ acteurId: 42 }));
  assert.equal(contexteCourant().acteurId, undefined);
});

// ── Lecture dans le contexte ─────────────────────────────────────────────────

test('les valeurs posées sont lisibles depuis la pile d appels', () => {
  executerAvecContexte({ ip: '10.0.0.1', userAgent: 'Firefox' }, () => {
    const profond = () => contexteCourant();
    assert.equal(profond().ip, '10.0.0.1');
    assert.equal(profond().userAgent, 'Firefox');
  });
});

test('le contexte est refermé à la sortie', () => {
  executerAvecContexte({ ip: '10.0.0.1' }, () => {
    assert.equal(contexteCourant().ip, '10.0.0.1');
  });
  assert.equal(contexteCourant().ip, undefined);
});

// ── La propriété qui justifie le mécanisme : la survie asynchrone ────────────

test('le contexte survit à un await', async () => {
  await executerAvecContexte({ ip: '10.0.0.2' }, async () => {
    await attendre();
    assert.equal(contexteCourant().ip, '10.0.0.2');
  });
});

test('le contexte survit à plusieurs niveaux d await imbriqués', async () => {
  await executerAvecContexte({ ip: '10.0.0.3' }, async () => {
    const niveau3 = async () => {
      await attendre();
      return contexteCourant().ip;
    };
    const niveau2 = async () => {
      await attendre();
      return niveau3();
    };
    assert.equal(await niveau2(), '10.0.0.3');
  });
});

test('le contexte survit à setTimeout', async () => {
  const lu = await new Promise<string | undefined>((resolve) => {
    executerAvecContexte({ ip: '10.0.0.4' }, () => {
      setTimeout(() => resolve(contexteCourant().ip), 5);
    });
  });
  assert.equal(lu, '10.0.0.4');
});

// ── Enrichissement après coup (l acteur n est connu qu après authentification) ──

test('enrichirContexte complète le contexte déjà ouvert', () => {
  executerAvecContexte({ ip: '10.0.0.5' }, () => {
    enrichirContexte({ acteurId: 7, acteurNom: 'Karim Trabelsi' });
    assert.equal(contexteCourant().ip, '10.0.0.5');
    assert.equal(contexteCourant().acteurId, 7);
    assert.equal(contexteCourant().acteurNom, 'Karim Trabelsi');
  });
});

test('enrichirContexte est visible depuis une continuation asynchrone', async () => {
  await executerAvecContexte({ ip: '10.0.0.6' }, async () => {
    enrichirContexte({ acteurId: 9 });
    await attendre();
    assert.equal(contexteCourant().acteurId, 9);
  });
});

// ── Isolation : deux requêtes concurrentes ne se mélangent pas ──────────────

test('deux contextes concurrents restent isolés', async () => {
  const requete = (ip: string, attente: number) =>
    executerAvecContexte({ ip }, async () => {
      await attendre(attente);
      return contexteCourant().ip;
    });

  // La première attend PLUS longtemps : si le stockage fuyait, elle lirait l IP de la seconde.
  const [a, b] = await Promise.all([requete('10.0.0.7', 20), requete('10.0.0.8', 1)]);
  assert.equal(a, '10.0.0.7');
  assert.equal(b, '10.0.0.8');
});

test('la mutation d un contexte ne touche pas l autre', async () => {
  const requete = (ip: string, id: number, attente: number) =>
    executerAvecContexte({ ip }, async () => {
      enrichirContexte({ acteurId: id });
      await attendre(attente);
      return contexteCourant().acteurId;
    });

  const [a, b] = await Promise.all([requete('10.0.0.9', 1, 20), requete('10.0.0.10', 2, 1)]);
  assert.equal(a, 1);
  assert.equal(b, 2);
});

test('l objet passé n est pas partagé avec l appelant (copie défensive)', () => {
  const original = { ip: '10.0.0.11' };
  executerAvecContexte(original, () => {
    enrichirContexte({ acteurId: 3 });
  });
  assert.equal((original as { acteurId?: number }).acteurId, undefined);
});

// ── executerSansContexte : couper l héritage pour les actions SYSTÈME ───────

test('executerSansContexte coupe l héritage du contexte utilisateur', () => {
  executerAvecContexte({ ip: '10.0.0.12', acteurId: 5 }, () => {
    executerSansContexte(() => {
      assert.equal(contexteCourant().ip, undefined);
      assert.equal(contexteCourant().acteurId, undefined);
    });
    // Le contexte extérieur est intact après coup.
    assert.equal(contexteCourant().ip, '10.0.0.12');
  });
});

test('executerSansContexte tient à travers les frontières asynchrones', async () => {
  await executerAvecContexte({ ip: '10.0.0.13' }, async () => {
    await executerSansContexte(async () => {
      await attendre();
      assert.equal(contexteCourant().ip, undefined);
    });
  });
});

test('aucune fonction du module ne lève, quelles que soient les entrées', () => {
  assert.doesNotThrow(() => executerAvecContexte({}, () => undefined));
  assert.doesNotThrow(() => executerSansContexte(() => undefined));
  assert.doesNotThrow(() => enrichirContexte({}));
  assert.doesNotThrow(() => contexteCourant());
});
