import { Router } from "express";
import { eq, desc, ilike, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// GET /projects
router.get("/", async (req, res) => {
  try {
    const { mode, search } = req.query as {
      mode?: string;
      search?: string;
    };

    const conditions = [];
    if (mode) conditions.push(eq(projectsTable.mode, mode));
    if (search) conditions.push(ilike(projectsTable.name, `%${search}%`));

    const rows = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        width: projectsTable.width,
        height: projectsTable.height,
        mode: projectsTable.mode,
        thumbnail: projectsTable.thumbnail,
        tags: projectsTable.tags,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      })
      .from(projectsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(projectsTable.updatedAt));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /projects
router.post("/", async (req, res) => {
  try {
    const { id, name, width, height, mode = "sprite", data, thumbnail, tags = [] } = req.body;

    if (!id || !name || !data) {
      res.status(400).json({ error: "id, name, and data are required" });
      return;
    }

    const [row] = await db
      .insert(projectsTable)
      .values({ id, name, width, height, mode, data, thumbnail, tags })
      .onConflictDoUpdate({
        target: projectsTable.id,
        set: {
          name,
          width,
          height,
          mode,
          data,
          thumbnail,
          tags,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: projectsTable.id,
        name: projectsTable.name,
        width: projectsTable.width,
        height: projectsTable.height,
        mode: projectsTable.mode,
        thumbnail: projectsTable.thumbnail,
        tags: projectsTable.tags,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      });

    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Failed to create project");
    res.status(500).json({ error: "Failed to save project" });
  }
});

// GET /projects/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Failed to load project" });
  }
});

// PUT /projects/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, width, height, mode, data, thumbnail, tags } = req.body;

    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [row] = await db
      .update(projectsTable)
      .set({ name, width, height, mode, data, thumbnail, tags, updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning({
        id: projectsTable.id,
        name: projectsTable.name,
        width: projectsTable.width,
        height: projectsTable.height,
        mode: projectsTable.mode,
        thumbnail: projectsTable.thumbnail,
        tags: projectsTable.tags,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      });

    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to update project");
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /projects/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete project");
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
