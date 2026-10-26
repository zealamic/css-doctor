import type { FC } from "react";
import { Link } from "react-router-dom";

const PageHome: FC = () => {
  return (
    <div className="space-y-8">
      <div className="home-pure-hero-card">
        <span className="home-pure-badge">Pure CSS Baseline</span>
        <h1 className="text-4xl font-extrabold text-white mt-4 mb-3 tracking-tight">
          Pure CSS &amp; Tailwind Ground
        </h1>
        <p className="text-slate-300 text-base max-w-2xl leading-relaxed mb-6">
          Trang chủ này hoàn toàn không import bất kỳ UI library nào. Điều này
          đảm bảo Vite và CSS Doctor có thể kiểm chứng việc cô lập hoàn toàn
          bundle của Antd, MUI và Chakra khỏi route chính.
        </p>

        <div className="flex gap-4">
          <Link className="home-pure-btn" to="/antd">
            Khám phá Ant Design
          </Link>
          <Link
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors"
            to="/mui"
          >
            Khám phá Material UI
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800">
          <h3 className="text-lg font-bold text-blue-400 mb-2">/antd Chunk</h3>
          <p className="text-slate-400 text-sm">
            Chỉ nạp CSS-in-JS và tokens của Ant Design v6 khi người dùng chuyển
            hướng.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800">
          <h3 className="text-lg font-bold text-purple-400 mb-2">/mui Chunk</h3>
          <p className="text-slate-400 text-sm">
            Chỉ kích hoạt Emotion engine và Mui* classes khi mở route MUI.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800">
          <h3 className="text-lg font-bold text-teal-400 mb-2">
            /chakra Chunk
          </h3>
          <p className="text-slate-400 text-sm">
            Chỉ nạp hệ thống token và runtime props của Chakra UI v3 khi tới
            route Chakra.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageHome;
