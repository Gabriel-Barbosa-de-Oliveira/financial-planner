import type { Category, CategoryFilters, CategoryRepository } from '../repositories/categoryRepository.ts';
import type { ClassificationRepository } from '../repositories/classificationRepository.ts';
import type { CategoryType } from '../config/category.ts';
import {
  CategoryAlreadyActiveError,
  CategoryNotFoundError,
  InvalidClassificationError,
  WorkspaceUnavailableError,
} from '../utils/errors.ts';

export type CreateCategoryInput = {
  name: string;
  type: CategoryType;
  classificationId?: string | null;
};

export type UpdateCategoryInput = {
  name?: string;
  classificationId?: string | null;
};

export type CategoryService = {
  createCategory: (input: CreateCategoryInput) => Promise<Category>;
  listCategories: (filters?: CategoryFilters) => Promise<Category[]>;
  getCategory: (id: string) => Promise<Category>;
  updateCategory: (id: string, input: UpdateCategoryInput) => Promise<Category>;
  deactivateCategory: (id: string) => Promise<void>;
  reactivateCategory: (id: string) => Promise<Category>;
};

export type CategoryServiceDependencies = {
  repository: CategoryRepository;
  classificationRepository: ClassificationRepository;
};

export function createCategoryService({
  repository,
  classificationRepository,
}: CategoryServiceDependencies): CategoryService {
  // Só aceita classificação ativa existente; null/ausente (sem classificação) não precisa de conferência
  async function assertClassification(classificationId: string | null | undefined) {
    if (typeof classificationId !== 'string') return;
    const classification = await classificationRepository.findById(classificationId);
    if (!classification) throw new InvalidClassificationError();
  }

  return {
    async createCategory({ name, type, classificationId }) {
      await assertClassification(classificationId);
      const category = await repository.create({ name, type, classificationId: classificationId ?? null });
      if (!category) throw new WorkspaceUnavailableError();
      return category;
    },

    listCategories(filters = {}) {
      return repository.findAll(filters);
    },

    async getCategory(id) {
      const category = await repository.findById(id);
      if (!category) throw new CategoryNotFoundError();
      return category;
    },

    async updateCategory(id, input) {
      await assertClassification(input.classificationId);
      const category = await repository.update(id, input);
      if (!category) throw new CategoryNotFoundError();
      return category;
    },

    async deactivateCategory(id) {
      const deactivated = await repository.deactivate(id);
      if (!deactivated) throw new CategoryNotFoundError();
    },

    async reactivateCategory(id) {
      const category = await repository.reactivate(id);
      if (category) return category;
      const isActive = await repository.findActiveState(id);
      if (isActive === true) throw new CategoryAlreadyActiveError();
      throw new CategoryNotFoundError();
    },
  };
}
