import { z } from 'zod';

export const getQuestionsSchema = z.object({
  grade: z.string().optional(),
  subject: z.string().optional(),
  limit: z.string().optional(),
  startAfter: z.string().optional()
});

export const submitAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  selectedIndex: z.number().int().min(0, 'Selected index must be valid'),
  userId: z.string().min(1, 'User ID is required')
});

export const submitExamSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  answers: z.array(
    z.object({
      questionId: z.string().min(1, 'Question ID is required'),
      selectedIndex: z.number().int().min(0, 'Selected index must be valid')
    })
  ),
  userId: z.string().min(1, 'User ID is required'),
  timeTaken: z.number().int().min(0).optional()
});

export const tenantSaveSchema = z.object({
  tenantData: z.object({
    name: z.string().min(3, 'Name must be at least 3 characters long'),
    subdomain: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Subdomain must be lowercase, alphanumeric, and contain no spaces'),
    theme: z.object({
      primaryColor: z.string(),
      logoUrl: z.string().url('Invalid Logo URL').optional().or(z.literal(''))
    }),
    plan: z.enum(['free', 'premium', 'enterprise']),
  }).passthrough(), // Allowing passthrough for `createdAt` and other dynamic fields if any
  oldTenantId: z.string().optional(),
  superAdminPassword: z.string().min(1, 'Super Admin Password is required')
});

export const adminPromoteSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  email: z.string().email('Invalid email address'),
  displayName: z.string().optional()
});

export const hashPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const tenantDeleteSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  superAdminPassword: z.string().min(1, 'Super Admin Password is required')
});

export const lessonIdParamSchema = z.object({
  lessonId: z.string().min(1)
});

export const navParamsSchema = z.object({
  courseId: z.string().min(1),
  currentOrder: z.string().regex(/^\d+$/, 'currentOrder must be a number')
});

export const fileProxyQuerySchema = z.object({
  data: z.string().min(1, 'Data parameter is required'),
  name: z.string().optional(),
  inline: z.string().optional()
});

export const youtubePlaylistQuerySchema = z.object({
  playlistId: z.string().min(1, 'Playlist ID is required')
});

// Types inferred from schemas for frontend/backend usage
export type GetQuestionsQuery = z.infer<typeof getQuestionsSchema>;
export type SubmitAnswerPayload = z.infer<typeof submitAnswerSchema>;
export type SubmitExamPayload = z.infer<typeof submitExamSchema>;
export type TenantSavePayload = z.infer<typeof tenantSaveSchema>;
export type AdminPromotePayload = z.infer<typeof adminPromoteSchema>;
export type HashPasswordPayload = z.infer<typeof hashPasswordSchema>;
export type TenantDeletePayload = z.infer<typeof tenantDeleteSchema>;
