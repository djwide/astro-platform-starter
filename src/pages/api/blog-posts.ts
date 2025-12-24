import type { APIRoute } from 'astro';
import { getStore } from '@netlify/blobs';

export const prerender = false;

const adminToken = process.env.BLOG_ADMIN_TOKEN;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const POST: APIRoute = async ({ request }) => {
  if (!adminToken) {
    return new Response(JSON.stringify({ error: 'Blog posting is not configured.' }), {
      status: 500
    });
  }

  const body = await request.json();
  const { title, body: content, author, adminToken: providedToken } = body ?? {};

  if (!providedToken || providedToken !== adminToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401 });
  }

  if (!title || !content) {
    return new Response(JSON.stringify({ error: 'Title and post body are required.' }), {
      status: 400
    });
  }

  const createdAt = new Date().toISOString();
  const slug = slugify(title);
  const key = `${createdAt}-${slug || 'post'}`;
  const blobStore = getStore('blog-posts');

  const post = {
    title,
    body: content,
    author: author || '',
    createdAt
  };

  await blobStore.setJSON(key, post);

  return new Response(JSON.stringify({ post }));
};

export const GET: APIRoute = async () => {
  const blobStore = getStore({ name: 'blog-posts', consistency: 'strong' });
  const list = await blobStore.list();
  const posts = await Promise.all(
    list.blobs.map(async ({ key }) => {
      const post = await blobStore.getJSON(key);
      return { ...post, key };
    })
  );

  const sortedPosts = posts
    .filter((post) => post?.title)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return new Response(JSON.stringify({ posts: sortedPosts }));
};
