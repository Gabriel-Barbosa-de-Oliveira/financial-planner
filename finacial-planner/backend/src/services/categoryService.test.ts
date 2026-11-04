import { describe, it, expect, jest } from '@jest/globals';
import { createCategoryService } from './categoryService.ts';
import type { Category, CategoryRepository } from '../repositories/categoryRepository.ts';
import type { Classification, ClassificationRepository } from '../repositories/classificationRepository.ts';
import {
  CategoryAlreadyActiveError,
  CategoryNotFoundError,
  InvalidClassificationError,
  UsedCategoryNameError,
  WorkspaceUnavailableError,
} from '../utils/errors.ts';

const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';
const CLASSIFICATION_ID = '0b9f4f55-6a47-4c53-9d0a-6a1b0f6a2c11';
const date = new Date('2026-11-03T10:00:00Z');

const category: Category = {
  id: ID,
  name: 'Gasolina',
  type: 'SAIDA',
  classification: { id: CLASSIFICATION_ID, name: 'Automóvel' },
  isActive: true,
  createdAt: date,
  updatedAt: date,
};

const classification: Classification = { id: CLASSIFICATION_ID, name: 'Automóvel', isActive: true, createdAt: date, updatedAt: date };

function setup() {
  const repository = {
    create: jest.fn<CategoryRepository['create']>().mockResolvedValue(category),
    findAll: jest.fn<CategoryRepository['findAll']>().mockResolvedValue([category]),
    findById: jest.fn<CategoryRepository['findById']>().mockResolvedValue(category),
    update: jest.fn<CategoryRepository['update']>().mockResolvedValue(category),
    deactivate: jest.fn<CategoryRepository['deactivate']>().mockResolvedValue(true),
    reactivate: jest.fn<CategoryRepository['reactivate']>().mockResolvedValue(category),
    findActiveState: jest.fn<CategoryRepository['findActiveState']>().mockResolvedValue(false),
  };
  const classificationRepository = {
    create: jest.fn<ClassificationRepository['create']>(),
    findAll: jest.fn<ClassificationRepository['findAll']>(),
    findById: jest.fn<ClassificationRepository['findById']>().mockResolvedValue(classification),
    update: jest.fn<ClassificationRepository['update']>(),
    deactivate: jest.fn<ClassificationRepository['deactivate']>(),
    reactivate: jest.fn<ClassificationRepository['reactivate']>(),
    findActiveState: jest.fn<ClassificationRepository['findActiveState']>(),
  };
  return { repository, classificationRepository, service: createCategoryService({ repository, classificationRepository }) };
}

describe('createCategoryService', () => {
  describe('createCategory', () => {
    it('confere a classificação e grava a categoria', async () => {
      const { repository, classificationRepository, service } = setup();
      const input = { name: 'Gasolina', type: 'SAIDA' as const, classificationId: CLASSIFICATION_ID };

      await expect(service.createCategory(input)).resolves.toEqual(category);

      expect(classificationRepository.findById).toHaveBeenCalledWith(CLASSIFICATION_ID);
      expect(repository.create).toHaveBeenCalledWith(input);
    });

    it.each([undefined, null])('sem classificação (%p) não consulta classificações e grava null', async (classificationId) => {
      const { repository, classificationRepository, service } = setup();

      await service.createCategory({ name: 'Salário', type: 'ENTRADA', classificationId });

      expect(classificationRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith({ name: 'Salário', type: 'ENTRADA', classificationId: null });
    });

    it('lança InvalidClassificationError sem gravar quando a classificação não existe ou está desativada', async () => {
      const { repository, classificationRepository, service } = setup();
      classificationRepository.findById.mockResolvedValue(null);

      await expect(
        service.createCategory({ name: 'A', type: 'SAIDA', classificationId: CLASSIFICATION_ID }),
      ).rejects.toBeInstanceOf(InvalidClassificationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lança WorkspaceUnavailableError quando nada é inserido e propaga nome repetido', async () => {
      const { repository, service } = setup();
      repository.create.mockResolvedValueOnce(null);
      await expect(service.createCategory({ name: 'A', type: 'SAIDA' })).rejects.toBeInstanceOf(WorkspaceUnavailableError);

      repository.create.mockRejectedValueOnce(new UsedCategoryNameError());
      await expect(service.createCategory({ name: 'A', type: 'SAIDA' })).rejects.toBeInstanceOf(UsedCategoryNameError);
    });
  });

  it('listCategories repassa os filtros e devolve a lista, inclusive vazia', async () => {
    const { repository, service } = setup();
    const filters = { classificationId: CLASSIFICATION_ID, type: 'SAIDA' as const };

    await expect(service.listCategories(filters)).resolves.toEqual([category]);
    expect(repository.findAll).toHaveBeenCalledWith(filters);

    await service.listCategories();
    expect(repository.findAll).toHaveBeenLastCalledWith({});

    repository.findAll.mockResolvedValue([]);
    await expect(service.listCategories()).resolves.toEqual([]);
  });

  it('getCategory devolve a categoria ou lança CategoryNotFoundError', async () => {
    const { repository, service } = setup();
    await expect(service.getCategory(ID)).resolves.toEqual(category);

    repository.findById.mockResolvedValue(null);
    await expect(service.getCategory(ID)).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  describe('updateCategory', () => {
    it('confere a nova classificação e repassa as mudanças', async () => {
      const { repository, classificationRepository, service } = setup();

      await expect(service.updateCategory(ID, { name: 'Combustível', classificationId: CLASSIFICATION_ID })).resolves.toEqual(category);

      expect(classificationRepository.findById).toHaveBeenCalledWith(CLASSIFICATION_ID);
      expect(repository.update).toHaveBeenCalledWith(ID, { name: 'Combustível', classificationId: CLASSIFICATION_ID });
    });

    it('null remove a classificação e só nome não consulta classificações', async () => {
      const { repository, classificationRepository, service } = setup();

      await service.updateCategory(ID, { classificationId: null });
      await service.updateCategory(ID, { name: 'X' });

      expect(classificationRepository.findById).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenNthCalledWith(1, ID, { classificationId: null });
      expect(repository.update).toHaveBeenNthCalledWith(2, ID, { name: 'X' });
    });

    it('lança InvalidClassificationError sem gravar quando a classificação é inválida', async () => {
      const { repository, classificationRepository, service } = setup();
      classificationRepository.findById.mockResolvedValue(null);

      await expect(service.updateCategory(ID, { classificationId: CLASSIFICATION_ID })).rejects.toBeInstanceOf(
        InvalidClassificationError,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('null do repository vira CategoryNotFoundError; nome repetido propaga', async () => {
      const { repository, service } = setup();
      repository.update.mockResolvedValueOnce(null);
      await expect(service.updateCategory(ID, { name: 'X' })).rejects.toBeInstanceOf(CategoryNotFoundError);

      repository.update.mockRejectedValueOnce(new UsedCategoryNameError());
      await expect(service.updateCategory(ID, { name: 'X' })).rejects.toBeInstanceOf(UsedCategoryNameError);
    });
  });

  it('deactivateCategory resolve quando desativa e lança CategoryNotFoundError quando não', async () => {
    const { repository, service } = setup();
    await expect(service.deactivateCategory(ID)).resolves.toBeUndefined();

    repository.deactivate.mockResolvedValue(false);
    await expect(service.deactivateCategory(ID)).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  describe('reactivateCategory', () => {
    it('devolve a categoria reativada sem consultar o estado', async () => {
      const { repository, service } = setup();

      await expect(service.reactivateCategory(ID)).resolves.toEqual(category);
      expect(repository.findActiveState).not.toHaveBeenCalled();
    });

    it('lança CategoryAlreadyActiveError quando já está ativa e CategoryNotFoundError quando não existe', async () => {
      const { repository, service } = setup();
      repository.reactivate.mockResolvedValue(null);

      repository.findActiveState.mockResolvedValue(true);
      await expect(service.reactivateCategory(ID)).rejects.toBeInstanceOf(CategoryAlreadyActiveError);

      repository.findActiveState.mockResolvedValue(null);
      await expect(service.reactivateCategory(ID)).rejects.toBeInstanceOf(CategoryNotFoundError);
    });

    it('propaga nome repetido', async () => {
      const { repository, service } = setup();
      repository.reactivate.mockRejectedValue(new UsedCategoryNameError());

      await expect(service.reactivateCategory(ID)).rejects.toBeInstanceOf(UsedCategoryNameError);
    });
  });
});
