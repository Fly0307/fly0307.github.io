import { z } from 'astro/zod';

export const postSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  language: z.enum(['zh', 'en']),
  tags: z.array(z.string().trim().min(1)).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.updatedAt && value.updatedAt < value.publishedAt) {
    context.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'updatedAt must be on or after publishedAt',
    });
  }
});

export type PostData = z.infer<typeof postSchema>;
export type PostLanguage = PostData['language'];
