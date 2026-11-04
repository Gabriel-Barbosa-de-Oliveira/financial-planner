import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import type { ClassificationService } from '../services/classificationService.ts';
import {
  classificationIdParamsSchema,
  createClassificationSchema,
  updateClassificationSchema,
} from './schemas/classification/classificationSchemas.ts';

export type ClassificationController = {
  create: RouteHandlerMethod;
  list: RouteHandlerMethod;
  getById: RouteHandlerMethod;
  update: RouteHandlerMethod;
  remove: RouteHandlerMethod;
  reactivate: RouteHandlerMethod;
};

export function createClassificationController(service: ClassificationService): ClassificationController {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const input = createClassificationSchema.parse(request.body);
      const classification = await service.createClassification(input);
      return reply.status(201).send(classification);
    },

    async list(_request: FastifyRequest, reply: FastifyReply) {
      const classifications = await service.listClassifications();
      return reply.status(200).send(classifications);
    },

    async getById(request: FastifyRequest, reply: FastifyReply) {
      const { id } = classificationIdParamsSchema.parse(request.params);
      const classification = await service.getClassification(id);
      return reply.status(200).send(classification);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
      const { id } = classificationIdParamsSchema.parse(request.params);
      const changes = updateClassificationSchema.parse(request.body);
      const classification = await service.updateClassification(id, changes);
      return reply.status(200).send(classification);
    },

    async remove(request: FastifyRequest, reply: FastifyReply) {
      const { id } = classificationIdParamsSchema.parse(request.params);
      await service.deactivateClassification(id);
      return reply.status(204).send();
    },

    async reactivate(request: FastifyRequest, reply: FastifyReply) {
      const { id } = classificationIdParamsSchema.parse(request.params);
      const classification = await service.reactivateClassification(id);
      return reply.status(200).send(classification);
    },
  };
}
