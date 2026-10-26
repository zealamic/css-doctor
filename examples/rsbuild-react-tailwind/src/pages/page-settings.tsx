import type { FC } from "react";

const PageSettings: FC = () => {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="panel-glass p-8">
        <h2 className="mb-4 text-2xl font-bold text-white">Project Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300" htmlFor="application-name">
              Application Name
            </label>
            <input
              id="application-name"
              type="text"
              defaultValue="rsbuild-react-tailwind"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-white"
            />
          </div>
          <div className="danger-section-divider pt-4">
            <button type="button" className="btn-primary-action">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageSettings;
