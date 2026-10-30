import { useEffect, useState } from "react";
import type { Comparison, Field, Ficha } from "@certia/core";
import { REGIONS } from "@certia/shared";
import { api, ApiError, post } from "./api";

// UI copy is in Spanish (user-facing); code is in English.

interface FichaSummary {
  code: string;
  version: number;
  name: string;
}

interface TrafficLightItem {
  kind: "expediente" | "lote";
  id: string;
  reference: string;
  status: string;
  days: number;
  color: "green" | "amber" | "red";
}

const formatKwh = (n: number) => `${n.toLocaleString("es-ES")} kWh`;

export function App() {
  const [error, setError] = useState<string>();
  const [fichas, setFichas] = useState<FichaSummary[]>([]);
  const [selected, setSelected] = useState<string>();
  const [ficha, setFicha] = useState<Ficha>();
  const [trafficLight, setTrafficLight] = useState<TrafficLightItem[]>([]);

  useEffect(() => {
    api<FichaSummary[]>("/fichas")
      .then((list) => {
        setFichas(list);
        const latest = list.at(-1);
        if (latest) setSelected(`${latest.code}/${latest.version}`);
      })
      .catch((e: Error) => setError(e.message));
    api<TrafficLightItem[]>("/dashboards/traffic-light").then(setTrafficLight).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) api<Ficha>(`/fichas/${selected}`).then(setFicha).catch((e: Error) => setError(e.message));
  }, [selected]);

  return (
    <div className="page">
      <header>
        <h1>Certia</h1>
        <span className="subtitle">Gestión de expedientes CAE</span>
      </header>

      {error && <p className="warning">No se pudo conectar con la API: {error}</p>}

      <main>
        <section className="card">
          <h2>Calculadora de ahorro</h2>
          <label>
            Ficha
            <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}>
              {fichas.map((f) => (
                <option key={`${f.code}/${f.version}`} value={`${f.code}/${f.version}`}>
                  {f.name} · v{f.version}
                </option>
              ))}
            </select>
          </label>
          {ficha && <Calculator key={`${ficha.code}@${ficha.version}`} ficha={ficha} />}
        </section>

        <section className="card">
          <h2>Semáforo</h2>
          {trafficLight.length === 0 ? (
            <p className="empty">Nada atascado. Los expedientes y lotes aparecerán aquí ordenados por días sin cambios.</p>
          ) : (
            <ul className="traffic-light">
              {trafficLight.map((item) => (
                <li key={item.id}>
                  <span className={`dot ${item.color}`} />
                  <span className="reference">{item.reference}</span>
                  <span className="status">{item.status.replaceAll("_", " ")}</span>
                  <span className="days">{item.days} d</span>
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
function Calculator({ ficha }: { ficha: Ficha }) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [comparison, setComparison] = useState<Comparison>();
  const [errors, setErrors] = useState<string[]>([]);

  const calculate = async () => {
    setErrors([]);
    try {
      setComparison(await post<Comparison>(`/fichas/${ficha.code}/compare`, { data }));
    } catch (e) {
      setErrors(e instanceof ApiError ? [e.message, ...e.details] : [String(e)]);
    }
  };

  return (
    <div className="calculator">
      {ficha.fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={data[field.id]}
          onChange={(v) => setData((d) => ({ ...d, [field.id]: v }))}
        />
      ))}
      <button onClick={calculate}>Calcular y comparar versiones</button>
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {comparison && (
        <table>
          <thead>
            <tr>
              <th>Versión</th>
              <th>Ahorro</th>
              <th>Documentos adicionales</th>
            </tr>
          </thead>
          <tbody>
            {comparison.versions.map((v) => (
              <tr key={v.version} className={comparison.best?.version === v.version ? "best" : ""}>
                <td>v{v.version}</td>
                <td>{v.result.ok ? formatKwh(v.result.kwh) : v.result.errors.join("; ")}</td>
                <td>{v.exclusiveDocuments.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const label = `${field.label}${field.unit ? ` (${field.unit})` : ""}${field.required ? "" : " · opcional"}`;
  switch (field.type) {
    case "boolean":
      return (
        <label className="checkbox">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      );
    case "enum":
    case "region": {
      const options = field.type === "region" ? [...REGIONS] : (field.options ?? []);
      return (
        <label>
          {label}
          <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">—</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }
    default: {
      const numeric = field.type === "number" || field.type === "integer";
      return (
        <label>
          {label}
          <input
            type={field.type === "date" ? "date" : numeric ? "number" : "text"}
            value={String(value ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : numeric ? Number(v) : v);
            }}
          />
        </label>
      );
    }
  }
}
