import type { FC } from "react";
import { Badge, Box, Button, Heading, HStack, Text } from "@chakra-ui/react";

const PageChakra: FC = () => {
  return (
    <Box className="chakra-showcase-shell space-y-6">
      <Box className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
        <Heading color="white" mb={2} size="lg">
          Chakra UI (v3) Playground
        </Heading>
        <Text color="gray.400" mb={6}>
          Testing Chakra UI design tokens, custom props, and runtime CSS
          isolation.
        </Text>

        <HStack gap={4} wrap="wrap">
          <Button colorPalette="teal" variant="solid">
            Chakra Solid
          </Button>
          <Button colorPalette="purple" variant="outline">
            Chakra Outline
          </Button>
          <Badge colorPalette="green">Chakra Badge</Badge>
          <Badge colorPalette="blue">Token Safe</Badge>
        </HStack>
      </Box>
    </Box>
  );
};

export default PageChakra;
