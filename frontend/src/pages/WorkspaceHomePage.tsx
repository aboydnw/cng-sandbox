import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useWorkspace } from "../hooks/useWorkspace";
import { listStoriesFromServer } from "../lib/story/api";
import { workspaceFetch } from "../lib/api";
import { config } from "../config";
import type { Story } from "../lib/story/types";
import type { Dataset } from "../types";
import { displayName } from "../utils/dataset";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sortByUpdated<T extends { updated_at?: string; created_at?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

export default function WorkspaceHomePage() {
  const { workspaceId, workspacePath } = useWorkspace();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listStoriesFromServer()
      .then((data) => {
        if (!cancelled) setStories(data);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    workspaceFetch(`${config.apiBase}/api/datasets`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Dataset[]) => {
        if (!cancelled) setDatasets(data);
      })
      .catch(() => {
        if (!cancelled) setDatasets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userStories = (stories ?? []).filter((s) => !s.is_example);
  const userDatasets = (datasets ?? []).filter((d) => !d.is_example);
  const recentStories = sortByUpdated(userStories).slice(0, 3);
  const recentDatasets = sortByUpdated(userDatasets).slice(0, 3);
  const loading = stories === null || datasets === null;

  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4} w="100%" flex="1">
        <Flex justify="space-between" align="center" mb={2}>
          <Heading size="lg" color="gray.800">
            Workspace home
          </Heading>
        </Flex>
        <Text fontSize="sm" color="gray.500" mb={6}>
          Workspace ID:{" "}
          <Text as="span" fontFamily="mono" color="gray.700">
            {workspaceId}
          </Text>
        </Text>

        {loading ? (
          <Flex justify="center" py={12}>
            <SpinnerGap
              size={32}
              style={{ animation: "spin 1s linear infinite" }}
            />
          </Flex>
        ) : (
          <>
            <Section
              title="Recent stories"
              viewAllLabel="View all stories"
              viewAllHref={workspacePath("/stories")}
              actionLabel="New story"
              actionHref={workspacePath("/story/new")}
              emptyText="No stories yet."
            >
              {recentStories.map((s) => (
                <Row
                  key={s.id}
                  title={s.title}
                  href={workspacePath(`/story/${s.id}/edit`)}
                  meta={s.updated_at ? timeAgo(s.updated_at) : "—"}
                />
              ))}
            </Section>

            <Box my={8} h="1px" bg="brand.border" />

            <Section
              title="Recent data"
              viewAllLabel="View all data"
              viewAllHref={workspacePath("/data")}
              actionLabel="Quick map"
              actionHref={workspacePath("/quick-map")}
              emptyText="No datasets yet."
            >
              {recentDatasets.map((d) => (
                <Row
                  key={d.id}
                  title={displayName(d)}
                  href={workspacePath(`/map/${d.id}`)}
                  meta={d.created_at ? timeAgo(d.created_at) : "—"}
                />
              ))}
            </Section>
          </>
        )}
      </Box>
      <Footer />
    </Flex>
  );
}

interface SectionProps {
  title: string;
  viewAllLabel: string;
  viewAllHref: string;
  actionLabel: string;
  actionHref: string;
  emptyText: string;
  children: React.ReactNode;
}

function Section({
  title,
  viewAllLabel,
  viewAllHref,
  actionLabel,
  actionHref,
  emptyText,
  children,
}: SectionProps) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="md" color="gray.700">
          {title}
        </Heading>
        <Link to={actionHref}>
          <Button
            size="sm"
            variant="outline"
            borderColor="brand.border"
            color="brand.brown"
          >
            {actionLabel}
          </Button>
        </Link>
      </Flex>
      {hasChildren ? (
        <Box>{children}</Box>
      ) : (
        <Text fontSize="sm" color="gray.500" mb={3}>
          {emptyText}
        </Text>
      )}
      <Link to={viewAllHref} style={{ textDecoration: "none" }}>
        <Flex
          align="center"
          gap={1}
          mt={3}
          fontSize="sm"
          color="brand.orange"
          fontWeight={500}
        >
          {viewAllLabel} <ArrowRight size={14} />
        </Flex>
      </Link>
    </Box>
  );
}

interface RowProps {
  title: string;
  href: string;
  meta: string;
}

function Row({ title, href, meta }: RowProps) {
  return (
    <Link to={href} style={{ textDecoration: "none" }}>
      <Flex
        justify="space-between"
        align="center"
        py={2}
        borderBottom="1px solid"
        borderColor="brand.border"
        _hover={{ bg: "brand.bgSubtle" }}
      >
        <Text color="brand.orange" fontWeight={500} truncate title={title}>
          {title}
        </Text>
        <Text fontSize="sm" color="gray.600">
          {meta}
        </Text>
      </Flex>
    </Link>
  );
}
