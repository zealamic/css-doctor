import type { FC } from "react";
import { Button, Card, Space, Tag, notification } from "antd";

const PageAntd: FC = () => {
  const [api, contextHolder] = notification.useNotification();

  const openNotification = () => {
    api.info({
      title: "Antd Notification",
      description:
        "Testing Ant Design v6 styles compatibility with CSS Doctor.",
      placement: "topRight",
    });
  };

  return (
    <div className="antd-showcase-shell space-y-6">
      {contextHolder}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-2">
          Ant Design (v6) Playground
        </h2>
        <p className="text-slate-400 mb-6">
          Testing Antd CSS-in-JS injection, components scoping, and Tailwind
          co-existence.
        </p>

        <Space size="middle" wrap>
          <Button onClick={openNotification} type="primary">
            Trigger Antd Notification
          </Button>
          <Button>Default Button</Button>
          <Button type="dashed">Dashed Button</Button>
          <Tag color="cyan">Antd Tag</Tag>
          <Tag color="magenta">Engine Test</Tag>
        </Space>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="!bg-slate-900/60 !border-slate-800 !text-white"
          title="Antd Card 1"
        >
          <p className="text-slate-300">
            Ant Design card component with custom theme tokens.
          </p>
        </Card>
        <Card
          className="!bg-slate-900/60 !border-slate-800 !text-white"
          title="Antd Card 2"
        >
          <p className="text-slate-300">
            Evaluating size-budget splitting on antd bundle chunk.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default PageAntd;
