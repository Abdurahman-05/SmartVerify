import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRoles } from '../../plugins/auth.js';
import { businessAccess } from '../../services/business-access.js';
import { getSettings } from '../../services/platform-settings.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';

const STATUSES = ['trial', 'active', 'grace', 'restricted', 'suspended'] as const;

export const accessSchema = z.object({
  status: z.enum(STATUSES),
  endsAt: z.string().nullable(),
  daysLeft: z.number().int().nullable(),
  nextStepAt: z.string().nullable(),
  remind: z.boolean(),
  suspendedByAdmin: z.boolean(),
  /** What Restricted blocks right now (empty unless restricted). */
  blocked: z.array(z.string()),
});

const profileSchema = z.object({
  name: z.string(),
  businessType: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

/**
 * Reads "lat,lng" from what the owner pastes: a Google Maps link (…/@9.01,38.76,17z or
 * …?q=9.01,38.76) or the two numbers themselves.
 */
export function coordinatesOf(text: string): { latitude: number; longitude: number } | null {
  const match =
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(text) ??
    /[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(text) ??
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/.exec(text);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** The business's own profile, its payment status, and the team's announcements. */
export const businessRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/business/access',
    {
      schema: {
        tags: ['business'],
        security,
        description:
          'Where the business is in the payment lifecycle (trial, active, grace, restricted, ' +
          'suspended), for the warning banner. Decided by the server from the admin rules.',
        response: { 200: accessSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const [access, settings] = await Promise.all([
        businessAccess(prisma, request.auth.businessId),
        getSettings(prisma),
      ]);
      return {
        status: access.status,
        endsAt: access.endsAt?.toISOString() ?? null,
        daysLeft: access.daysLeft,
        nextStepAt: access.nextStepAt?.toISOString() ?? null,
        remind: access.remind,
        suspendedByAdmin: access.suspendedByAdmin,
        blocked: access.status === 'restricted' ? settings.restrictedBlocks : [],
      };
    }
  );

  app.get(
    '/business/profile',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['business'],
        security,
        response: { 200: profileSchema, 401: errorResponseSchema, 403: errorResponseSchema },
      },
    },
    async (request) =>
      prisma.business.findUniqueOrThrow({
        where: { id: request.auth.businessId },
        select: {
          name: true,
          businessType: true,
          city: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      })
  );

  app.patch(
    '/business/profile',
    {
      preHandler: requireRoles('owner'),
      schema: {
        tags: ['business'],
        security,
        description:
          'Owner: business type, city, address and location. `location` is a Google Maps ' +
          'link or "lat,lng"; an empty string clears it. Seen by the Smart Verify team only.',
        body: z.object({
          businessType: z.string().trim().max(60).nullable().optional(),
          city: z.string().trim().max(60).nullable().optional(),
          address: z.string().trim().max(200).nullable().optional(),
          location: z.string().trim().max(500).optional(),
        }),
        response: {
          200: profileSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR (reason: location)'),
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const { location, ...rest } = request.body;
      const empty = (v: string | null | undefined) => (v === '' ? null : v);
      let coordinates: { latitude: number | null; longitude: number | null } | null = null;
      if (location !== undefined) {
        if (location === '') coordinates = { latitude: null, longitude: null };
        else {
          coordinates = coordinatesOf(location);
          if (!coordinates) throw new AppError('VALIDATION_ERROR', { reason: 'location' });
        }
      }
      return prisma.business.update({
        where: { id: request.auth.businessId },
        data: {
          businessType: empty(rest.businessType),
          city: empty(rest.city),
          address: empty(rest.address),
          ...(coordinates && {
            ...coordinates,
            locationSetAt: coordinates.latitude === null ? null : new Date(),
          }),
        },
        select: {
          name: true,
          businessType: true,
          city: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      });
    }
  );

  app.get(
    '/announcements',
    {
      schema: {
        tags: ['business'],
        security,
        description: 'Announcements from the Smart Verify team showing now for this business.',
        response: {
          200: z.array(z.object({ id: z.string(), bodyEn: z.string(), bodyAm: z.string() })),
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const now = new Date();
      const business = await prisma.business.findUniqueOrThrow({
        where: { id: request.auth.businessId },
        select: { plan: true, city: true },
      });
      const rows = await prisma.announcement.findMany({
        where: { showFrom: { lte: now }, hideOn: { gt: now } },
        orderBy: { showFrom: 'desc' },
        take: 5,
      });
      return rows
        .filter(
          (a) =>
            a.audience === 'all' ||
            (a.audience === 'plan' && a.plan === business.plan) ||
            (a.audience === 'city' &&
              !!a.city &&
              a.city.toLowerCase() === (business.city ?? '').toLowerCase())
        )
        .map((a) => ({ id: a.id, bodyEn: a.bodyEn, bodyAm: a.bodyAm }));
    }
  );
};
