import content from './site-content.json';
import { siteContentSchema } from '../lib/site-content';

export const site = {
  ...siteContentSchema.parse(content),
  canonicalUrl: 'https://fly0307.github.io',
};
