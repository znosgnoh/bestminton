/** Serialize Prisma results (Dates → ISO strings) for client DTOs. */
export function toDTO<T>(data: unknown): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
