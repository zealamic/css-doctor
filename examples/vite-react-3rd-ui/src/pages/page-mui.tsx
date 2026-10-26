import type { FC } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

const PageMui: FC = () => {
  return (
    <div className="mui-showcase-shell space-y-6">
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
        <Typography
          variant="h5"
          component="h2"
          sx={{ color: "#fff", fontWeight: 700, mb: 1 }}
        >
          Material UI (MUI v6) Playground
        </Typography>
        <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
          Verifying Emotion engine styles, Mui* runtime classes, and CSS Doctor
          safety boundaries.
        </Typography>

        <Stack direction="row" flexWrap="wrap" gap={2}>
          <Button color="primary" variant="contained">
            MUI Contained
          </Button>
          <Button color="secondary" variant="outlined">
            MUI Outlined
          </Button>
          <Chip color="info" label="MUI Chip" />
          <Chip
            variant="outlined"
            label="Zero Runtime Hazard"
            sx={{ color: "#fff" }}
          />
        </Stack>
      </div>

      <Card
        variant="outlined"
        sx={{
          bgcolor: "rgba(23, 15, 42, 0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>
            Emotion Engine Verification
          </Typography>
          <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
            Ensuring dynamic style elements are preserved during
            post-processing.
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default PageMui;
