import type { Comparison, Difference, VersionComparison as Version } from "@certia/core";

/**
 * Visual comparison of a measure's versions (F-07): savings and payout per version,
 * the best one highlighted and the difference against the baseline.
 * Reused by the calculator and, later, by the case page.
 */

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const kwh = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });

function formatDifference(d: Difference, showEur: boolean) {
  const sign = d.kwh > 0 ? "+" : d.kwh < 0 ? "−" : "±";
  const amount = showEur && d.eur !== null ? eur.format(Math.abs(d.eur)) : `${kwh.format(Math.abs(d.kwh))} kWh`;
  const percent = d.percent === null ? "" : ` (${sign}${Math.abs(d.percent)} %)`;
  return `${sign}${amount}${percent}`;
}

function trend(d: Difference) {
  return d.kwh > 0 ? "up" : d.kwh < 0 ? "down" : "flat";
}

export function VersionComparison({ comparison }: { comparison: Comparison }) {
  const showEur = comparison.pricePerKwh !== null;
  const value = (v: Version) => (v.result.ok ? (showEur ? (v.payoutEur ?? 0) : v.result.kwh) : 0);
  const max = Math.max(1, ...comparison.versions.map(value));
  const baseline = comparison.versions.find((v) => v.isBaseline);

  return (
    <div className="comparison">
      <Summary comparison={comparison} baseline={baseline} showEur={showEur} />

      <ul className="versions">
        {comparison.versions.map((v) => (
          <li key={v.version} className={v.isBest ? "version best" : "version"}>
            <div className="version-head">
              <span className="version-name">
                v{v.version} · {v.name}
              </span>
              <span className="badges">
                {v.isBaseline && <span className="badge">Baseline</span>}
                {v.isBest && <span className="badge best">Best</span>}
              </span>
            </div>
            <div className="version-validity">
              In force from {v.validity.from}
              {v.validity.to ? ` to ${v.validity.to}` : ""}
            </div>

            {v.result.ok ? (
              <>
                <div className="bar-track" aria-hidden="true">
                  <div className="bar" style={{ width: `${(value(v) / max) * 100}%` }} />
                </div>
                <div className="version-figures">
                  <span className="money">{showEur && v.payoutEur !== null ? eur.format(v.payoutEur) : `${kwh.format(v.result.kwh)} kWh`}</span>
                  {showEur && <span className="kwh">{kwh.format(v.result.kwh)} kWh</span>}
                  {v.vsBaseline && (
                    <span className={`delta ${trend(v.vsBaseline)}`}>{formatDifference(v.vsBaseline, showEur)} vs baseline</span>
                  )}
                </div>
              </>
            ) : (
              <div className="not-calculable">
                Cannot be calculated with the current data:
                <ul>
                  {v.result.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {v.exclusiveDocuments.length > 0 && (
              <div className="extra-docs">Also requires: {v.exclusiveDocuments.join(", ")}</div>
            )}
          </li>
        ))}
      </ul>

      {showEur && (
        <p className="footnote">Payout = savings × {eur.format(comparison.pricePerKwh ?? 0)} per kWh.</p>
      )}
    </div>
  );
}

function Summary({ comparison, baseline, showEur }: { comparison: Comparison; baseline?: Version; showEur: boolean }) {
  const { best, gainVsBaseline } = comparison;
  if (!best) return <p className="summary neutral">No version can be calculated with the current data yet.</p>;
  if (!baseline?.result.ok) {
    return (
      <p className="summary neutral">
        The baseline (v{comparison.baselineVersion}) cannot be calculated; v{best.version} is the best calculable version.
      </p>
    );
  }
  if (!gainVsBaseline) {
    return <p className="summary neutral">v{best.version} is already the most favorable version.</p>;
  }
  return (
    <p className="summary positive">
      Switching from v{comparison.baselineVersion} to v{best.version} gives{" "}
      <strong>{formatDifference(gainVsBaseline, showEur)}</strong>.
    </p>
  );
}
