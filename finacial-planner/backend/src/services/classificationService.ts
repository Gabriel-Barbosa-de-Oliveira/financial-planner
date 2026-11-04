import type { Classification, ClassificationRepository } from '../repositories/classificationRepository.ts';
import {
  ClassificationAlreadyActiveError,
  ClassificationNotFoundError,
  WorkspaceUnavailableError,
} from '../utils/errors.ts';

export type CreateClassificationInput = {
  name: string;
};

export type UpdateClassificationInput = {
  name: string;
};

export type ClassificationService = {
  createClassification: (input: CreateClassificationInput) => Promise<Classification>;
  listClassifications: () => Promise<Classification[]>;
  getClassification: (id: string) => Promise<Classification>;
  updateClassification: (id: string, input: UpdateClassificationInput) => Promise<Classification>;
  deactivateClassification: (id: string) => Promise<void>;
  reactivateClassification: (id: string) => Promise<Classification>;
};

export type ClassificationServiceDependencies = {
  repository: ClassificationRepository;
};

export function createClassificationService({ repository }: ClassificationServiceDependencies): ClassificationService {
  return {
    async createClassification(input) {
      const classification = await repository.create(input);
      if (!classification) throw new WorkspaceUnavailableError();
      return classification;
    },

    listClassifications() {
      return repository.findAll();
    },

    async getClassification(id) {
      const classification = await repository.findById(id);
      if (!classification) throw new ClassificationNotFoundError();
      return classification;
    },

    async updateClassification(id, input) {
      const classification = await repository.update(id, input);
      if (!classification) throw new ClassificationNotFoundError();
      return classification;
    },

    async deactivateClassification(id) {
      const deactivated = await repository.deactivate(id);
      if (!deactivated) throw new ClassificationNotFoundError();
    },

    async reactivateClassification(id) {
      const classification = await repository.reactivate(id);
      if (classification) return classification;
      const isActive = await repository.findActiveState(id);
      if (isActive === true) throw new ClassificationAlreadyActiveError();
      throw new ClassificationNotFoundError();
    },
  };
}
