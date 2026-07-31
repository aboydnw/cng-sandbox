import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layer } from "@deck.gl/core";

export interface StoryScene<Payload> {
  key: string;
  layers: Layer[];
  payload: Payload;
}

interface PreparedStoryScene<Payload> extends StoryScene<Payload> {
  generation: number;
  sourceLayers: Layer[];
  hidden: boolean;
}

interface AtomicSceneState<Payload> {
  committed: PreparedStoryScene<Payload>;
  pending: PreparedStoryScene<Payload> | null;
}

function cloneSceneLayer(
  layer: Layer,
  generation: number,
  hidden: boolean
): Layer {
  return layer.clone({
    id: `${layer.id}--story-scene-${generation}`,
    opacity: hidden ? 0 : layer.props.opacity,
  });
}

function prepareScene<Payload>(
  scene: StoryScene<Payload>,
  generation: number,
  hidden: boolean
): PreparedStoryScene<Payload> {
  return {
    ...scene,
    generation,
    sourceLayers: scene.layers,
    hidden,
    layers: scene.layers.map((layer) =>
      cloneSceneLayer(layer, generation, hidden)
    ),
  };
}

function refreshPreparedScene<Payload>(
  current: PreparedStoryScene<Payload>,
  scene: StoryScene<Payload>,
  hidden: boolean
): PreparedStoryScene<Payload> {
  const currentBySourceId = new Map(
    current.sourceLayers.map((source, index) => [
      source.id,
      { source, prepared: current.layers[index] },
    ])
  );

  return {
    ...scene,
    generation: current.generation,
    sourceLayers: scene.layers,
    hidden,
    layers: scene.layers.map((source) => {
      const previous = currentBySourceId.get(source.id);
      if (previous?.source === source && current.hidden === hidden) {
        return previous.prepared;
      }
      return cloneSceneLayer(source, current.generation, hidden);
    }),
  };
}

function pendingSceneIsReady<Payload>(
  scene: PreparedStoryScene<Payload>
): boolean {
  // Empty or fully hidden scenes intentionally commit without waiting.
  return scene.layers.every((layer) => layer.isLoaded);
}

/**
 * Owns the visible story-layer generation.
 *
 * A replacement scene is mounted with zero-opacity layers under fresh IDs so
 * deck.gl can prepare its async resources without visually overlapping the
 * committed scene. Once every pending layer reports loaded, one state update
 * promotes that generation and disposes the previous one. A newer target
 * replaces any pending generation, so late A/B work cannot restore stale data.
 */
export function useAtomicStoryScene<Payload>(scene: StoryScene<Payload>): {
  layers: Layer[];
  payload: Payload;
  transitioning: boolean;
  onAfterRender: () => void;
} {
  const nextGenerationRef = useRef(1);
  const latestSceneRef = useRef(scene);
  latestSceneRef.current = scene;

  const [state, setState] = useState<AtomicSceneState<Payload>>(() => ({
    committed: prepareScene(scene, 0, false),
    pending: null,
  }));

  useEffect(() => {
    setState((current) => {
      if (scene.key === current.committed.key) {
        return current.pending ? { ...current, pending: null } : current;
      }
      if (scene.key === current.pending?.key) return current;

      const generation = nextGenerationRef.current++;
      return {
        ...current,
        pending: prepareScene(scene, generation, true),
      };
    });
  }, [scene.key]);

  const pendingKey = state.pending?.key;
  useEffect(() => {
    if (!pendingKey || pendingKey !== scene.key) return;
    setState((current) => {
      if (current.pending?.key !== scene.key) return current;
      return {
        ...current,
        pending: refreshPreparedScene(current.pending, scene, true),
      };
    });
  }, [pendingKey, scene]);

  const visibleScene = useMemo(() => {
    if (scene.key !== state.committed.key) return state.committed;
    return refreshPreparedScene(state.committed, scene, false);
  }, [scene, state.committed]);

  const onAfterRender = useCallback(() => {
    setState((current) => {
      const pending = current.pending;
      if (!pending || !pendingSceneIsReady(pending)) return current;

      const latest = latestSceneRef.current;
      if (latest.key !== pending.key) return current;

      return {
        committed: refreshPreparedScene(pending, latest, false),
        pending: null,
      };
    });
  }, []);

  const layers = useMemo(
    () =>
      state.pending
        ? [...visibleScene.layers, ...state.pending.layers]
        : visibleScene.layers,
    [state.pending, visibleScene.layers]
  );

  return {
    layers,
    payload: visibleScene.payload,
    transitioning: state.pending !== null,
    onAfterRender,
  };
}
