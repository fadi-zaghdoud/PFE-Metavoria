import { categorieRepository } from '../repositories/categorie.repository';

export const categorieService = {
  lister() {
    return categorieRepository.findMany();
  },
};
