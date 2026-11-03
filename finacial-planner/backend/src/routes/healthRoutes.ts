import { FastifyInstance } from "fastify";
import pool from "../config/database";

export async function getHealth(app: FastifyInstance) {
    app.get('/health', async (_request, reply) => {
        const dbStart = Date.now();

        try {
            await pool.query('SELECT 1');
        } catch {
            reply.status(503);
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                database: { status: 'error' },
            };
        }

        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: { status: 'ok', latencyMs: Date.now() - dbStart },
        };
    });
}