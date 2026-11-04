import { describe, it, expect, jest } from '@jest/globals';
import { createClassificationService } from './classificationService.ts';
import type { Classification, ClassificationRepository } from '../repositories/classificationRepository.ts';
import {
  ClassificationAlreadyActiveError,
  ClassificationNotFoundError,
  UsedClassificationNameError,
  WorkspaceUnavailableError,
} from '../utils/errors.ts';

const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';

const classification: Classification = {
  id: ID,
  name: 'Automóvel',
  isActive: true,
  createdAt: new Date('2026-11-03T10:00:00Z'),
  updatedAt: new Date('2026-11-03T10:00:00Z'),
};

function setup() {
  const repository = {
    create: jest.fn<ClassificationRepository['create']>().mockResolvedValue(classification),
    findAll: jest.fn<ClassificationRepository['findAll']>().mockResolvedValue([classification]),
    findById: jest.fn<ClassificationRepository['findById']>().mockResolvedValue(classification),
    update: jest.fn<ClassificationRepository['update']>().mockResolvedValue(classification),
    deactivate: jest.fn<ClassificationRepository['deactivate']>().mockResolvedValue(true),
    reactivate: jest.fn<ClassificationRepository['reactivate']>().mockResolvedValue(classification),
    findActiveState: jest.fn<ClassificationRepository['findActiveState']>().mockResolvedValue(false),
  };
  return { repository, service: createClassificationService({ repository }) };
}

describe('createClassificationService', () => {
  it('createClassification repassa os dados e devolve a classificação', async () => {
    const { repository, service } = setup();

    await expect(service.createClassification({ name: 'Automóvel' })).resolves.toEqual(classification);
    expect(repository.create).toHaveBeenCalledWith({ name: 'Automóvel' });
  });

  it('createClassification lança WorkspaceUnavailableError quando nada é inserido e propaga nome repetido', async () => {
    const { repository, service } = setup();
    repository.create.mockResolvedValueOnce(null);
    await expect(service.createClassification({ name: 'A' })).rejects.toBeInstanceOf(WorkspaceUnavailableError);

    repository.create.mockRejectedValueOnce(new UsedClassificationNameError());
    await expect(service.createClassification({ name: 'A' })).rejects.toBeInstanceOf(UsedClassificationNameError);
  });

  it('listClassifications devolve a lista do repository, inclusive vazia', async () => {
    const { repository, service } = setup();
    await expect(service.listClassifications()).resolves.toEqual([classification]);

    repository.findAll.mockResolvedValue([]);
    await expect(service.listClassifications()).resolves.toEqual([]);
  });

  it('getClassification devolve a classificação ou lança ClassificationNotFoundError', async () => {
    const { repository, service } = setup();
    await expect(service.getClassification(ID)).resolves.toEqual(classification);

    repository.findById.mockResolvedValue(null);
    await expect(service.getClassification(ID)).rejects.toBeInstanceOf(ClassificationNotFoundError);
  });

  it('updateClassification repassa id e dados; null vira ClassificationNotFoundError; nome repetido propaga', async () => {
    const { repository, service } = setup();
    await expect(service.updateClassification(ID, { name: 'Veículos' })).resolves.toEqual(classification);
    expect(repository.update).toHaveBeenCalledWith(ID, { name: 'Veículos' });

    repository.update.mockResolvedValueOnce(null);
    await expect(service.updateClassification(ID, { name: 'X' })).rejects.toBeInstanceOf(ClassificationNotFoundError);

    repository.update.mockRejectedValueOnce(new UsedClassificationNameError());
    await expect(service.updateClassification(ID, { name: 'X' })).rejects.toBeInstanceOf(UsedClassificationNameError);
  });

  it('deactivateClassification resolve quando desativa e lança ClassificationNotFoundError quando não', async () => {
    const { repository, service } = setup();
    await expect(service.deactivateClassification(ID)).resolves.toBeUndefined();
    expect(repository.deactivate).toHaveBeenCalledWith(ID);

    repository.deactivate.mockResolvedValue(false);
    await expect(service.deactivateClassification(ID)).rejects.toBeInstanceOf(ClassificationNotFoundError);
  });

  describe('reactivateClassification', () => {
    it('devolve a classificação reativada sem consultar o estado', async () => {
      const { repository, service } = setup();

      await expect(service.reactivateClassification(ID)).resolves.toEqual(classification);
      expect(repository.findActiveState).not.toHaveBeenCalled();
    });

    it('lança ClassificationAlreadyActiveError quando já está ativa', async () => {
      const { repository, service } = setup();
      repository.reactivate.mockResolvedValue(null);
      repository.findActiveState.mockResolvedValue(true);

      await expect(service.reactivateClassification(ID)).rejects.toBeInstanceOf(ClassificationAlreadyActiveError);
    });

    it('lança ClassificationNotFoundError quando não existe', async () => {
      const { repository, service } = setup();
      repository.reactivate.mockResolvedValue(null);
      repository.findActiveState.mockResolvedValue(null);

      await expect(service.reactivateClassification(ID)).rejects.toBeInstanceOf(ClassificationNotFoundError);
    });

    it('propaga nome repetido', async () => {
      const { repository, service } = setup();
      repository.reactivate.mockRejectedValue(new UsedClassificationNameError());

      await expect(service.reactivateClassification(ID)).rejects.toBeInstanceOf(UsedClassificationNameError);
    });
  });
});
