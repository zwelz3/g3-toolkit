/**
 * MapView: geographic visualization with edges (F6a, F6b).
 *
 * Renders nodes with lat/lon as markers, edges as arcs between
 * geo-positioned nodes. Selection linking via store.
 *
 * F6a: Edges rendered as SVG lines/arcs between geo nodes.
 * F6b: Tile URL prop for adopter-provided map background
 *       (actual tile rendering requires Leaflet/Maplibre GL;
 *       this provides the hook for integration).
 *
 * @see specs/01-functional-views.md R1.3
 */

import { useMemo, useCallback, useRef } from "react";
import type { UGM } from "@g3t/core";
import { DESIGN_TOKENS } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { EmptyState } from "../../interaction/feedback";

export interface MapViewProps {
  ugm: UGM;
  /** Show edges between geo-positioned nodes. Default true. */
  showEdges?: boolean;
  /** Tile URL template for background map. Not rendered directly;
   *  provided for Leaflet/Maplibre integration via onTileUrlChange. */
  tileUrl?: string;
  className?: string;
}

interface GeoNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
}

interface GeoEdge {
  sourceId: string;
  targetId: string;
  label: string;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
}

/** Project lat/lon to SVG x/y (equirectangular). */
function project(
  lat: number,
  lon: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

export function MapView({ ugm, showEdges = true, className }: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedNodeIds, selectNodes } = useSelectionStore();

  // Extract geo nodes
  const geoNodes = useMemo<GeoNode[]>(() => {
    const result: GeoNode[] = [];
    ugm.forEachNode((id, attrs) => {
      const lat = attrs.properties.lat ?? attrs.properties.latitude;
      const lon = attrs.properties.lon ?? attrs.properties.longitude;
      if (typeof lat === "number" && typeof lon === "number") {
        result.push({
          id,
          name:
            typeof attrs.properties.name === "string"
              ? attrs.properties.name
              : id,
          lat,
          lon,
          type: attrs.types[0] ?? "Unknown",
        });
      }
    });
    return result;
  }, [ugm]);

  // F6a: Extract edges between geo-positioned nodes
  const geoEdges = useMemo<GeoEdge[]>(() => {
    if (!showEdges) return [];
    const geoNodeMap = new Map(geoNodes.map((n) => [n.id, n]));
    const edges: GeoEdge[] = [];
    ugm.forEachEdge((_eid, attrs, source, target) => {
      const srcGeo = geoNodeMap.get(source);
      const tgtGeo = geoNodeMap.get(target);
      if (srcGeo && tgtGeo) {
        edges.push({
          sourceId: source,
          targetId: target,
          label: typeof attrs.type === "string" ? attrs.type : "",
          sourcePos: project(srcGeo.lat, srcGeo.lon, 800, 400),
          targetPos: project(tgtGeo.lat, tgtGeo.lon, 800, 400),
        });
      }
    });
    return edges;
  }, [ugm, geoNodes, showEdges]);

  const handleMarkerClick = useCallback(
    (nodeId: string) => selectNodes([nodeId]),
    [selectNodes],
  );

  const viewBox = useMemo(() => {
    if (geoNodes.length === 0) return { x: 0, y: 0, w: 800, h: 400 };
    const selectedId = [...selectedNodeIds][0];
    if (!selectedId) return { x: 0, y: 0, w: 800, h: 400 };
    const node = geoNodes.find((n) => n.id === selectedId);
    if (!node) return { x: 0, y: 0, w: 800, h: 400 };
    const { x, y } = project(node.lat, node.lon, 800, 400);
    return { x: x - 100, y: y - 50, w: 200, h: 100 };
  }, [selectedNodeIds, geoNodes]);

  return (
    <div
      data-testid="map-view"
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    >
      {geoNodes.length === 0 ? (
        <EmptyState
          testId="map-empty"
          icon="info"
          title="No geographic data"
          description="The map places nodes by their lat and lon properties. Load geo-tagged nodes to see them positioned."
        />
      ) : (
        <svg
          ref={svgRef}
          data-testid="map-svg"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{
            width: "100%",
            height: "100%",
            background: "var(--g3t-canvas-bg, #e8f4f8)",
          }}
        >
          {/* F6a: Edge arcs */}
          {geoEdges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              data-testid={`map-edge-${edge.sourceId}-${edge.targetId}`}
              x1={edge.sourcePos.x}
              y1={edge.sourcePos.y}
              x2={edge.targetPos.x}
              y2={edge.targetPos.y}
              stroke="var(--g3t-border, #94a3b8)"
              strokeWidth={0.8}
              strokeDasharray="2,1"
              opacity={0.6}
            />
          ))}

          {/* Node markers */}
          {geoNodes.map((node) => {
            const { x, y } = project(node.lat, node.lon, 800, 400);
            const isSelected = selectedNodeIds.has(node.id);
            return (
              <g key={node.id} data-testid={`map-marker-${node.id}`}>
                {/* C1 selection signature (channel-allocation table,
                    design/projection-and-encoding.md): selection adds
                    the accent HALO; it never recolors the marker. The
                    previous code swapped fill to a hardcoded blue,
                    which both violated the allocation and destroyed
                    the marker's categorical color on selection. */}
                {isSelected ? (
                  <circle
                    data-testid={`map-halo-${node.id}`}
                    cx={x}
                    cy={y}
                    r={9}
                    fill="none"
                    stroke="var(--g3t-accent-primary, #0072b2)"
                    strokeWidth={parseInt(DESIGN_TOKENS.selectionHaloWidth, 10)}
                  />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={5}
                  fill="var(--g3t-type-1, #e67e22)"
                  stroke="var(--g3t-node-stroke, #94a3b8)"
                  strokeWidth={1}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleMarkerClick(node.id)}
                />
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--g3t-text-secondary, #666)"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
