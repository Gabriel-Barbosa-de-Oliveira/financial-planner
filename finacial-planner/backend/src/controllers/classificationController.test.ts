import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../server.ts';
import { createClassificationController } from './classificationController.ts';
import type { ClassificationService } from '../services/classificationService.ts';
import {
  ClassificationAlreadyActiveError,
  ClassificationNotFoundError,
  UsedClassificationNameError,
  WorkspaceUnavailableError,
} from '../utils/errors.ts';

const classification = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  name: 'Automóvel',
  isActive: true,
  createdAt: new Date('2026-11-03T10:00:00Z'),
  updatedAt: new Date('2026-11-03T10:00:00Z'),
};

describe('createClassificationController', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let service: { [K in keyof ClassificationService]: jest.Mock<ClassificationService[K]> };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = {
      createClassification: jest.fn<ClassificationService['createClassification']>().mockResolvedValue(classification),
      listClassifications: jest.fn<ClassificationService['listClassifications']>().mockResolvedValue([classification]),
      getClassification: jest.fn<ClassificationService['getClassification']>().mockResolvedValue(classification),
      updateClassification: jest.fn<ClassificationService['updateClassification']>().mockResolvedValue(classification),
      deactivateClassification: jest.fn<ClassificationService['deactivateClassification']>().mockResolvedValue(undefined),
      reactivateClassification: jest.fn<ClassificationService['reactivateClassification']>().mockResolvedValue(classification),
    };
    const controller = createClassificationController(service);
    app = await createServer(false);
    app.post('/classifications', controller.create);
    app.get('/classifications', controller.list);
    app.get('/classifications/:id', controller.getById);
    app.patch('/classifications/:id', controller.update);
    app.delete('/classifications/:id', controller.remove);
    app.post('/classifications/:id/reactivate', controller.reactivate);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const send = (method: 'POST' | 'PATCH' | 'DELETE' | 'GET', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}) });
  const issueFields = (response: { json: () => { issues: Array<{ field: string }> } }) =>
    response.json().issues.map((issue) => issue.field);

  describe('create', () => {
    it('cria com nome aparado e responde 201', async () => {
      const response = await send('POST', '/classifications', { name: '  Automóvel ' });

      expect(response.statusCode).toBe(201);
      expect(service.createClassification).toHaveBeenCalledWith({ name: 'Automóvel' });
      expect(response.json()).toMatchObject({ id: classification.id, name: 'Automóvel', isActive: true });
    });

    it('responde 400 com issues por campo e não chama o service', async () => {
      const response = await send('POST', '/classifications', { name: '' });

      expect(response.statusCode).toBe(400);
      expect(issueFields(response)).toEqual(['name']);
      expect(service.createClassification).not.toHaveBeenCalled();
    });

    it('responde 400 para campos proibidos', async () => {
      expect((await send('POST', '/classifications', { name: 'A', isActive: false })).statusCode).toBe(400);
      expect((await send('POST', '/classifications', { name: 'A', workspaceId: classification.id })).statusCode).toBe(400);
      expect(service.createClassification).not.toHaveBeenCalled();
    });

    it('traduz nome repetido em 409 e workspace ausente em 422', async () => {
      service.createClassification.mockRejectedValueOnce(new UsedClassificationNameError());
      const used = await send('POST', '/classifications', { name: 'Automóvel' });
      expect(used.statusCode).toBe(409);
      expect(used.json().message).toBe('Já existe uma classificação com este nome');

      service.createClassification.mockRejectedValueOnce(new WorkspaceUnavailableError());
      expect((await send('POST', '/classifications', { name: 'A' })).statusCode).toBe(422);
    });

    it('responde 500 genérico em erro inesperado, sem detalhes', async () => {
      service.createClassification.mockRejectedValueOnce(new Error('connection refused to 10.0.0.1'));

      const response = await send('POST', '/classifications', { name: 'A' });

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('10.0.0.1');
    });
  });

  describe('list e getById', () => {
    it('lista com 200 e consulta por id com 200', async () => {
      const list = await send('GET', '/classifications');
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(1);

      const one = await send('GET', `/classifications/${classification.id}`);
      expect(one.statusCode).toBe(200);
      expect(service.getClassification).toHaveBeenCalledWith(classification.id);
    });

    it('responde 400 para id inválido sem chamar o service e 404 para inexistente', async () => {
      const invalid = await send('GET', '/classifications/abc');
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().issues[0].message).toBe('Identificador inválido');
      expect(service.getClassification).not.toHaveBeenCalled();

      service.getClassification.mockRejectedValueOnce(new ClassificationNotFoundError());
      const missing = await send('GET', `/classifications/${classification.id}`);
      expect(missing.statusCode).toBe(404);
      expect(missing.json().message).toBe('Classificação não encontrada');
    });
  });

  describe('update', () => {
    it('altera o nome e responde 200', async () => {
      const response = await send('PATCH', `/classifications/${classification.id}`, { name: ' Veículos ' });

      expect(response.statusCode).toBe(200);
      expect(service.updateClassification).toHaveBeenCalledWith(classification.id, { name: 'Veículos' });
    });

    it('responde 400 para corpo vazio, campo proibido e id inválido', async () => {
      expect((await send('PATCH', `/classifications/${classification.id}`, {})).statusCode).toBe(400);
      expect((await send('PATCH', `/classifications/${classification.id}`, { name: 'A', isActive: false })).statusCode).toBe(400);
      expect((await send('PATCH', '/classifications/abc', { name: 'A' })).statusCode).toBe(400);
      expect(service.updateClassification).not.toHaveBeenCalled();
    });

    it('traduz 404 e 409', async () => {
      service.updateClassification.mockRejectedValueOnce(new ClassificationNotFoundError());
      expect((await send('PATCH', `/classifications/${classification.id}`, { name: 'A' })).statusCode).toBe(404);

      service.updateClassification.mockRejectedValueOnce(new UsedClassificationNameError());
      expect((await send('PATCH', `/classifications/${classification.id}`, { name: 'A' })).statusCode).toBe(409);
    });
  });

  describe('remove', () => {
    it('desativa e responde 204 sem corpo', async () => {
      const response = await send('DELETE', `/classifications/${classification.id}`);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(service.deactivateClassification).toHaveBeenCalledWith(classification.id);
    });

    it('responde 400 para id inválido e 404 para inexistente', async () => {
      expect((await send('DELETE', '/classifications/abc')).statusCode).toBe(400);
      expect(service.deactivateClassification).not.toHaveBeenCalled();

      service.deactivateClassification.mockRejectedValueOnce(new ClassificationNotFoundError());
      expect((await send('DELETE', `/classifications/${classification.id}`)).statusCode).toBe(404);
    });
  });

  describe('reactivate', () => {
    it('reativa e responde 200 com a classificação', async () => {
      const response = await send('POST', `/classifications/${classification.id}/reactivate`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: classification.id });
      expect(service.reactivateClassification).toHaveBeenCalledWith(classification.id);
    });

    it('responde 400 para id inválido, 404, e 409 para nome em uso ou já ativa', async () => {
      expect((await send('POST', '/classifications/abc/reactivate')).statusCode).toBe(400);
      expect(service.reactivateClassification).not.toHaveBeenCalled();

      service.reactivateClassification.mockRejectedValueOnce(new ClassificationNotFoundError());
      expect((await send('POST', `/classifications/${classification.id}/reactivate`)).statusCode).toBe(404);

      service.reactivateClassification.mockRejectedValueOnce(new UsedClassificationNameError());
      expect((await send('POST', `/classifications/${classification.id}/reactivate`)).statusCode).toBe(409);

      service.reactivateClassification.mockRejectedValueOnce(new ClassificationAlreadyActiveError());
      const active = await send('POST', `/classifications/${classification.id}/reactivate`);
      expect(active.statusCode).toBe(409);
      expect(active.json().message).toBe('Classificação já está ativa');
    });
  });
});
