type OpenApiSchema = Record<string, unknown>;

/** Preenche `content.*.example` a partir dos `example` das propriedades do schema (Swagger UI). */
export function enrichSwaggerResponseExamples(document: object) {
  const doc = document as {
    components?: { schemas?: Record<string, OpenApiSchema> };
    paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
  };
  const schemas = doc.components?.schemas ?? {};

  const resolveRef = (ref: string): OpenApiSchema | undefined => {
    const name = ref.replace('#/components/schemas/', '');
    return schemas[name];
  };

  const exampleFromSchema = (schema: OpenApiSchema | undefined): unknown => {
    if (!schema) return undefined;
    if (schema.example !== undefined) return schema.example;
    if (schema.$ref) return exampleFromSchema(resolveRef(String(schema.$ref)));
    if (schema.allOf && Array.isArray(schema.allOf)) {
      const merged: Record<string, unknown> = {};
      for (const part of schema.allOf) {
        const ex = exampleFromSchema(part as OpenApiSchema);
        if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
          Object.assign(merged, ex);
        }
      }
      return Object.keys(merged).length ? merged : undefined;
    }
    if (schema.type === 'array' && schema.items) {
      const item = exampleFromSchema(schema.items as OpenApiSchema);
      return item === undefined ? undefined : [item];
    }
    if (schema.type === 'object' || schema.properties) {
      const props = (schema.properties ?? {}) as Record<string, OpenApiSchema>;
      const out: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(props)) {
        const val = exampleFromSchema(prop);
        if (val !== undefined) out[key] = val;
      }
      return Object.keys(out).length ? out : undefined;
    }
    if (schema.type === 'string') return schema.example ?? 'string';
    if (schema.type === 'number' || schema.type === 'integer') return schema.example ?? 0;
    if (schema.type === 'boolean') return schema.example ?? false;
    return undefined;
  };

  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(pathItem)) {
      if (!op?.responses) continue;
      for (const response of Object.values(op.responses)) {
        const resp = response as {
          content?: Record<
            string,
            { schema?: OpenApiSchema; example?: unknown; examples?: unknown }
          >;
        };
        if (!resp.content) continue;
        for (const media of Object.values(resp.content)) {
          if (media.example !== undefined || media.examples) continue;
          const ex = exampleFromSchema(media.schema);
          if (ex !== undefined) media.example = ex;
        }
      }
    }
  }
}
