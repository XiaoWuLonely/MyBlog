import type { MetadataRoute } from "next";
import {
  getCachedAllPosts,
  getCachedAllProjects,
  getCachedAllResources,
} from "@/lib/cached-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://example.com";
  const [posts, projects, resources] = await Promise.all([
    getCachedAllPosts(),
    getCachedAllProjects(),
    getCachedAllResources(),
  ]);

  const routes = ["", "/archive", "/projects", "/resources", "/about"].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));

  const postRoutes = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.slug}`,
    lastModified: new Date(post.date),
  }));

  const projectRoutes = projects.map((project) => ({
    url: `${baseUrl}/projects/${project.slug}`,
    lastModified: new Date(project.date),
  }));

  const resourceRoutes = resources.map((resource) => ({
    url: `${baseUrl}/resources/${resource.slug}`,
    lastModified: new Date(resource.date),
  }));

  return [...routes, ...postRoutes, ...projectRoutes, ...resourceRoutes];
}
