import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../server.ts';
import { createCategoryController } from './categoryController.ts';
import type { CategoryService } from '../services/categoryService.ts';
import {
  CategoryAlreadyActiveError,
  CategoryNotFoundError,
  InvalidClassificationError,
  UsedCategoryNameError,
  WorkspaceUnavailableError,
} from '../utils/errors.ts';

const CLASSIFICATION_ID = '0b9f4f55-6a47-4c53-9d0a-6a1b0f6a2c11';
const category = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  name: 'Gasolina',
  type: 'SAIDA' as const,
  classification: { id: CLASSIFICATION_ID, name: 'Automóvel' },
  isActive: true,
  createdAt: new Date('2026-11-03T10:00:00Z'),
  updatedAt: new Date('2026-11-03T10:00:00Z'),
};

describe('createCategoryController', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let service: { [K in keyof CategoryService]: jest.Mock<CategoryService[K]> };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = {
      createCategory: jest.fn<CategoryService['createCategory']>().mockResolvedValue(category),
      listCategories: jest.fn<CategoryService['listCategories']>().mockResolvedValue([category]),
      getCategory: jest.fn<CategoryService['getCategory']>().mockResolvedValue(category),
      updateCategory: jest.fn<CategoryService['updateCategory']>().mockResolvedValue(category),
      deactivateCategory: jest.fn<CategoryService['deactivateCategory']>().mockResolvedValue(undefined),
      reactivateCategory: jest.fn<CategoryService['reactivateCategory']>().mockResolvedValue(category),
    };
    const controller = createCategoryController(service);
    app = await createServer(false);
    app.post('/categories', controller.create);
    app.get('/categories', controller.list);
    app.get('/categories/:id', controller.getById);
    app.patch('/categories/:id', controller.update);
    app.delete('/categories/:id', controller.remove);
    app.post('/categories/:id/reactivate', controller.reactivate);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const send = (method: 'POST' | 'PATCH' | 'DELETE' | 'GET', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}) });
  const issueFields = (response: { json: () => { issues: Array<{ field: string }> } }) =>
    response.json().issues.map((issue) => issue.field).sort();

  describe('create', () => {
    it('cria com classificação, nome aparado, e responde 201 com a classificação aninhada', async () => {
      const response = await send('POST', '/categories', { name: ' Gasolina ', type: 'SAIDA', classificationId: CLASSIFICATION_ID });

      expect(response.statusCode).toBe(201);
      expect(service.createCategory).toHaveBeenCalledWith({ name: 'Gasolina', type: 'SAIDA', classificationId: CLASSIFICATION_ID });
      expect(response.json()).toMatchObject({ id: category.id, classification: { id: CLASSIFICATION_ID, name: 'Automóvel' } });
    });

    it('cria sem classificação', async () => {
      await send('POST', '/categories', { name: 'Salário', type: 'ENTRADA' });

      expect(service.createCategory).toHaveBeenCalledWith({ name: 'Salário', type: 'ENTRADA' });
    });

    it('responde 400 com issues por campo e não chama o service', async () => {
      const response = await send('POST', '/categories', { name: '', type: 'XYZ', classificationId: 'abc' });

      expect(response.statusCode).toBe(400);
      expect(issueFields(response)).toEqual(['classificationId', 'name', 'type']);
      expect(service.createCategory).not.toHaveBeenCalled();
    });

    it('responde 400 para campos proibidos', async () => {
      expect((await send('POST', '/categories', { name: 'A', type: 'SAIDA', isActive: false })).statusCode).toBe(400);
      expect((await send('POST', '/categories', { name: 'A', type: 'SAIDA', workspaceId: category.id })).statusCode).toBe(400);
      expect(service.createCategory).not.toHaveBeenCalled();
    });

    it('traduz nome repetido em 409, classificação inválida em 422 e workspace ausente em 422', async () => {
      service.createCategory.mockRejectedValueOnce(new UsedCategoryNameError());
      const used = await send('POST', '/categories', { name: 'A', type: 'SAIDA' });
      expect(used.statusCode).toBe(409);
      expect(used.json().message).toBe('Já existe uma categoria com este nome para este tipo');

      service.createCategory.mockRejectedValueOnce(new InvalidClassificationError());
      const invalid = await send('POST', '/categories', { name: 'A', type: 'SAIDA', classificationId: CLASSIFICATION_ID });
      expect(invalid.statusCode).toBe(422);
      expect(invalid.json().error).toBe('INVALID_CLASSIFICATION');

      service.createCategory.mockRejectedValueOnce(new WorkspaceUnavailableError());
      expect((await send('POST', '/categories', { name: 'A', type: 'SAIDA' })).statusCode).toBe(422);
    });

    it('responde 500 genérico em erro inesperado, sem detalhes', async () => {
      service.createCategory.mockRejectedValueOnce(new Error('connection refused to 10.0.0.1'));

      const response = await send('POST', '/categories', { name: 'A', type: 'SAIDA' });

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('10.0.0.1');
    });
  });

  describe('list', () => {
    it('lista sem filtros com 200', async () => {
      const response = await send('GET', '/categories');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
      expect(service.listCategories).toHaveBeenCalledWith({});
    });

    it('repassa os filtros de classificação e tipo', async () => {
      await send('GET', `/categories?classificationId=${CLASSIFICATION_ID}&type=ENTRADA`);

      expect(service.listCategories).toHaveBeenCalledWith({ classificationId: CLASSIFICATION_ID, type: 'ENTRADA' });
    });

    it('responde 400 para filtro inválido ou desconhecido sem chamar o service', async () => {
      const type = await send('GET', '/categories?type=XYZ');
      expect(type.statusCode).toBe(400);
      expect(issueFields(type)).toEqual(['type']);

      expect((await send('GET', '/categories?classificationId=abc')).statusCode).toBe(400);
      expect((await send('GET', '/categories?foo=bar')).statusCode).toBe(400);
      expect(service.listCategories).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('consulta por id com 200', async () => {
      const response = await send('GET', `/categories/${category.id}`);

      expect(response.statusCode).toBe(200);
      expect(service.getCategory).toHaveBeenCalledWith(category.id);
    });

    it('responde 400 para id inválido sem chamar o service e 404 para inexistente', async () => {
      const invalid = await send('GET', '/categories/abc');
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().issues[0].message).toBe('Identificador inválido');
      expect(service.getCategory).not.toHaveBeenCalled();

      service.getCategory.mockRejectedValueOnce(new CategoryNotFoundError());
      const missing = await send('GET', `/categories/${category.id}`);
      expect(missing.statusCode).toBe(404);
      expect(missing.json().message).toBe('Categoria não encontrada');
    });
  });

  describe('update', () => {
    it('altera nome e classificação, inclusive com null, e responde 200', async () => {
      await send('PATCH', `/categories/${category.id}`, { name: ' Combustível ', classificationId: CLASSIFICATION_ID });
      expect(service.updateCategory).toHaveBeenLastCalledWith(category.id, { name: 'Combustível', classificationId: CLASSIFICATION_ID });

      const response = await send('PATCH', `/categories/${category.id}`, { classificationId: null });
      expect(response.statusCode).toBe(200);
      expect(service.updateCategory).toHaveBeenLastCalledWith(category.id, { classificationId: null });
    });

    it('responde 400 para corpo vazio, tipo, campos proibidos e id inválido', async () => {
      expect((await send('PATCH', `/categories/${category.id}`, {})).statusCode).toBe(400);
      expect((await send('PATCH', `/categories/${category.id}`, { type: 'ENTRADA' })).statusCode).toBe(400);
      expect((await send('PATCH', `/categories/${category.id}`, { name: 'A', isActive: false })).statusCode).toBe(400);
      expect((await send('PATCH', '/categories/abc', { name: 'A' })).statusCode).toBe(400);
      expect(service.updateCategory).not.toHaveBeenCalled();
    });

    it('traduz 404, 409 e 422', async () => {
      service.updateCategory.mockRejectedValueOnce(new CategoryNotFoundError());
      expect((await send('PATCH', `/categories/${category.id}`, { name: 'A' })).statusCode).toBe(404);

      service.updateCategory.mockRejectedValueOnce(new UsedCategoryNameError());
      expect((await send('PATCH', `/categories/${category.id}`, { name: 'A' })).statusCode).toBe(409);

      service.updateCategory.mockRejectedValueOnce(new InvalidClassificationError());
      expect((await send('PATCH', `/categories/${category.id}`, { classificationId: CLASSIFICATION_ID })).statusCode).toBe(422);
    });
  });

  describe('remove', () => {
    it('desativa e responde 204 sem corpo', async () => {
      const response = await send('DELETE', `/categories/${category.id}`);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(service.deactivateCategory).toHaveBeenCalledWith(category.id);
    });

    it('responde 400 para id inválido e 404 para inexistente', async () => {
      expect((await send('DELETE', '/categories/abc')).statusCode).toBe(400);
      expect(service.deactivateCategory).not.toHaveBeenCalled();

      service.deactivateCategory.mockRejectedValueOnce(new CategoryNotFoundError());
      expect((await send('DELETE', `/categories/${category.id}`)).statusCode).toBe(404);
    });
  });

  describe('reactivate', () => {
    it('reativa e responde 200 com a categoria', async () => {
      const response = await send('POST', `/categories/${category.id}/reactivate`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: category.id });
      expect(service.reactivateCategory).toHaveBeenCalledWith(category.id);
    });

    it('responde 400 para id inválido, 404, e 409 para nome em uso ou já ativa', async () => {
      expect((await send('POST', '/categories/abc/reactivate')).statusCode).toBe(400);
      expect(service.reactivateCategory).not.toHaveBeenCalled();

      service.reactivateCategory.mockRejectedValueOnce(new CategoryNotFoundError());
      expect((await send('POST', `/categories/${category.id}/reactivate`)).statusCode).toBe(404);

      service.reactivateCategory.mockRejectedValueOnce(new UsedCategoryNameError());
      expect((await send('POST', `/categories/${category.id}/reactivate`)).statusCode).toBe(409);

      service.reactivateCategory.mockRejectedValueOnce(new CategoryAlreadyActiveError());
      const active = await send('POST', `/categories/${category.id}/reactivate`);
      expect(active.statusCode).toBe(409);
      expect(active.json().message).toBe('Categoria já está ativa');
    });
  });
});
