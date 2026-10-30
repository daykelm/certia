export class ErrorApi extends Error {
  constructor(
    message: string,
    public readonly detalles: string[] = [],
  ) {
    super(message);
  }
}

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${ruta}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(cuerpo.error ?? `Error ${res.status}`, cuerpo.detalles);
  return cuerpo as T;
}

export const post = <T>(ruta: string, cuerpo: unknown) => api<T>(ruta, { method: "POST", body: JSON.stringify(cuerpo) });
