import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import type { CategoryService } from '../services/categoryService.ts';
import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from './schemas/category/categorySchemas.ts';

export type CategoryController = {
  create: RouteHandlerMethod;
  list: RouteHandlerMethod;
  getById: RouteHandlerMethod;
  update: RouteHandlerMethod;
  remove: RouteHandlerMethod;
  reactivate: RouteHandlerMethod;
};

export function createCategoryController(service: CategoryService): CategoryController {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const input = createCategorySchema.parse(request.body);
      const category = await service.createCategory(input);
      return reply.status(201).send(category);
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const filters = listCategoriesQuerySchema.parse(request.query);
      const categories = await service.listCategories(filters);
      return reply.status(200).send(categories);
    },

    async getById(request: FastifyRequest, reply: FastifyReply) {
      const { id } = categoryIdParamsSchema.parse(request.params);
      const category = await service.getCategory(id);
      return reply.status(200).send(category);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
      const { id } = categoryIdParamsSchema.parse(request.params);
      const changes = updateCategorySchema.parse(request.body);
      const category = await service.updateCategory(id, changes);
      return reply.status(200).send(category);
    },

    async remove(request: FastifyRequest, reply: FastifyReply) {
      const { id } = categoryIdParamsSchema.parse(request.params);
      await service.deactivateCategory(id);
      return reply.status(204).send();
    },

    async reactivate(request: FastifyRequest, reply: FastifyReply) {
      const { id } = categoryIdParamsSchema.parse(request.params);
      const category = await service.reactivateCategory(id);
      return reply.status(200).send(category);
    },
  };
}
