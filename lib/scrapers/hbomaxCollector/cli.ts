/**
 * `scripts/hbomax-*.ts` üçün ortaq giriş nöqtəsi: xətanı kodu + növbəti addımla
 * çap edir və prosesi sıfırdan fərqli kodla bitirir. Xəta udulmur.
 */
import { isHboError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";

export function runCli(main: () => Promise<void>): void {
  main().then(
    () => process.exit(0),
    (err: unknown) => {
      if (isHboError(err)) {
        hboLog.error(`${err.code}: ${err.message}`);
        hboLog.error(`Next step: ${err.hint}`);
      } else {
        hboLog.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
      }
      process.exit(1);
    }
  );
}
