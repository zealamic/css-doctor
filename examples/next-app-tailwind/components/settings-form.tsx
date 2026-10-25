import styles from "../styles/settings.module.css";

export function SettingsForm() {
  return (
    <form className={styles.formSection}>
      <label className="flex items-center justify-between gap-6">
        <span>
          <span className="block text-sm font-medium text-slate-100">
            Usage analytics
          </span>
          <span className="mt-1 block text-xs text-slate-400">
            Share anonymous performance data.
          </span>
        </span>
        <input className={styles.toggleSwitch} type="checkbox" />
      </label>
      <button className={styles.saveButton} type="submit">
        Save preferences
      </button>
    </form>
  );
}
