import { useEffect, useState } from "react";
import type { Campo, Comparacion, Ficha } from "@certia/core";
import { CCAA } from "@certia/shared";
import { api, ErrorApi, post } from "./api";

interface ResumenFicha {
  codigo: string;
  version: number;
  nombre: string;
}

interface ItemSemaforo {
  tipo: "expediente" | "lote";
  id: string;
  referencia: string;
  estado: string;
  dias: number;
  color: "verde" | "amarillo" | "rojo";
}

const kwh = (n: number) => `${n.toLocaleString("es-ES")} kWh`;

export function App() {
  const [error, setError] = useState<string>();
  const [fichas, setFichas] = useState<ResumenFicha[]>([]);
  const [seleccion, setSeleccion] = useState<string>();
  const [ficha, setFicha] = useState<Ficha>();
  const [semaforo, setSemaforo] = useState<ItemSemaforo[]>([]);

  useEffect(() => {
    api<ResumenFicha[]>("/fichas")
      .then((f) => {
        setFichas(f);
        const ultima = f.at(-1);
        if (ultima) setSeleccion(`${ultima.codigo}/${ultima.version}`);
      })
      .catch((e: Error) => setError(e.message));
    api<ItemSemaforo[]>("/paneles/semaforo").then(setSemaforo).catch(() => {});
  }, []);

  useEffect(() => {
    if (seleccion) api<Ficha>(`/fichas/${seleccion}`).then(setFicha).catch((e: Error) => setError(e.message));
  }, [seleccion]);

  return (
    <div className="pagina">
      <header>
        <h1>Certia</h1>
        <span className="sub">Gestión de expedientes CAE</span>
      </header>

      {error && <p className="aviso">No se pudo conectar con la API: {error}</p>}

      <main>
        <section className="tarjeta">
          <h2>Calculadora de ahorro</h2>
          <label>
            Ficha
            <select value={seleccion ?? ""} onChange={(e) => setSeleccion(e.target.value)}>
              {fichas.map((f) => (
                <option key={`${f.codigo}/${f.version}`} value={`${f.codigo}/${f.version}`}>
                  {f.nombre} · v{f.version}
                </option>
              ))}
            </select>
          </label>
          {ficha && <Calculadora key={`${ficha.codigo}@${ficha.version}`} ficha={ficha} />}
        </section>

        <section className="tarjeta">
          <h2>Semáforo</h2>
          {semaforo.length === 0 ? (
            <p className="vacio">Nada atascado. Los expedientes y lotes aparecerán aquí ordenados por días sin cambios.</p>
          ) : (
            <ul className="semaforo">
              {semaforo.map((s) => (
                <li key={s.id}>
                  <span className={`punto ${s.color}`} />
                  <span className="ref">{s.referencia}</span>
                  <span className="estado">{s.estado.replaceAll("_", " ")}</span>
                  <span className="dias">{s.dias} d</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/** Form generated from the ficha's fields (F-03). */
function Calculadora({ ficha }: { ficha: Ficha }) {
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [resultado, setResultado] = useState<Comparacion>();
  const [errores, setErrores] = useState<string[]>([]);

  const calcular = async () => {
    setErrores([]);
    try {
      setResultado(await post<Comparacion>(`/fichas/${ficha.codigo}/comparar`, { datos }));
    } catch (e) {
      setErrores(e instanceof ErrorApi ? [e.message, ...e.detalles] : [String(e)]);
    }
  };

  return (
    <div className="calculadora">
      {ficha.campos.map((campo) => (
        <CampoFicha
          key={campo.id}
          campo={campo}
          valor={datos[campo.id]}
          onChange={(v) => setDatos((d) => ({ ...d, [campo.id]: v }))}
        />
      ))}
      <button onClick={calcular}>Calcular y comparar versiones</button>
      {errores.length > 0 && <ul className="errores">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
      {resultado && (
        <table>
          <thead>
            <tr>
              <th>Versión</th>
              <th>Ahorro</th>
              <th>Documentos adicionales</th>
            </tr>
          </thead>
          <tbody>
            {resultado.versiones.map((v) => (
              <tr key={v.version} className={resultado.mejor?.version === v.version ? "mejor" : ""}>
                <td>v{v.version}</td>
                <td>{v.resultado.ok ? kwh(v.resultado.kwh) : v.resultado.errores.join("; ")}</td>
                <td>{v.documentosExclusivos.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CampoFicha({ campo, valor, onChange }: { campo: Campo; valor: unknown; onChange: (v: unknown) => void }) {
  const etiqueta = `${campo.etiqueta}${campo.unidad ? ` (${campo.unidad})` : ""}${campo.obligatorio ? "" : " · opcional"}`;
  switch (campo.tipo) {
    case "booleano":
      return (
        <label className="check">
          <input type="checkbox" checked={Boolean(valor)} onChange={(e) => onChange(e.target.checked)} />
          {etiqueta}
        </label>
      );
    case "enum":
    case "ccaa": {
      const opciones = campo.tipo === "ccaa" ? [...CCAA] : (campo.opciones ?? []);
      return (
        <label>
          {etiqueta}
          <select value={String(valor ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">—</option>
            {opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }
    default: {
      const numerico = campo.tipo === "numero" || campo.tipo === "entero";
      return (
        <label>
          {etiqueta}
          <input
            type={campo.tipo === "fecha" ? "date" : numerico ? "number" : "text"}
            value={String(valor ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : numerico ? Number(v) : v);
            }}
          />
        </label>
      );
    }
  }
}
