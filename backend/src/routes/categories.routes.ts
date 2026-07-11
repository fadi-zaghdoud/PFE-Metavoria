import { Router } from 'express';
import { categorieController } from '../controllers/categorie.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get('/', asyncHandler(categorieController.lister));
