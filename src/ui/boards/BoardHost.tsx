import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import AssetsManagerBoard from "./AssetsManagerBoard";
import BoardFrame from "./BoardFrame";
import BrushBoard from "./BrushBoard";
import HelpBoard from "./HelpBoard";
import ScenesBoard from "./ScenesBoard";
import SettingsBoard from "./SettingsBoard";
import TilesBoard from "./TilesBoard";
import TileSettingsBoard from "./TileSettingsBoard";
import type { BoardId, BoardState, Dock } from "./boardTypes";
import { useBoards } from "./useBoards";

type BoardHostProps = {
  campaignLoaded: boolean;
};

type FloatDragState = {
  kind: "float";
  id: BoardId;
  offsetX: number;
  offsetY: number;
};

type DockDragState = {
  kind: "dock";
  id: BoardId;
  dock: Exclude<Dock, "float">;
  offsetX: number;
  offsetY: number;
  clientX: number;
  clientY: number;
  width: number;
  height: number;
};

type DragState = FloatDragState | DockDragState;

type FloatResizeState = {
  id: BoardId;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

type DockResizeState = {
  id: BoardId;
  dock: Exclude<Dock, "float">;
  startX: number;
  startSize: number;
};

const SNAP_DOCK_DISTANCE = 30;
const UNDOCK_DISTANCE = 60;
const MIN_FLOAT_WIDTH = 250;
const MIN_FLOAT_HEIGHT = 170;
const MIN_DOCK_SIZE = 220;
const MAX_DOCK_SIZE = 560;
const CANCEL_TABLETOP_INTERACTIONS_EVENT = "dnd:cancel-tabletop-interactions";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const cancelTabletopInteractions = () => {
  window.dispatchEvent(new Event(CANCEL_TABLETOP_INTERACTIONS_EVENT));
};
const arrayEquals = <T,>(a: T[], b: T[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
};
const mergeDockOrder = (previousOrder: BoardId[], liveIds: BoardId[]) => {
  const liveIdSet = new Set(liveIds);
  const kept = previousOrder.filter((id) => liveIdSet.has(id));
  const keptSet = new Set(kept);
  const appended = liveIds.filter((id) => !keptSet.has(id));
  return [...kept, ...appended];
};

const hostStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2090,
  pointerEvents: "none",
};

const floatingLayerStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
};

const leftDockStyle: CSSProperties = {
  position: "fixed",
  left: 12,
  top: 56,
  bottom: 12,
  display: "grid",
  alignContent: "start",
  gap: 8,
  pointerEvents: "none",
};

const rightDockStyle: CSSProperties = {
  position: "fixed",
  right: 12,
  top: 56,
  bottom: 12,
  display: "grid",
  alignContent: "start",
  justifyItems: "end",
  gap: 8,
  pointerEvents: "none",
};

const getBoardContent = (id: BoardId, campaignLoaded: boolean) => {
  switch (id) {
    case "assets":
      return <AssetsManagerBoard />;
    case "brush":
      return <BrushBoard />;
    case "tiles":
      return <TilesBoard />;
    case "tileSettings":
      return <TileSettingsBoard />;
    case "scenes":
      return <ScenesBoard />;
    case "settings":
      return <SettingsBoard campaignLoaded={campaignLoaded} />;
    case "help":
      return <HelpBoard />;
    default:
      return null;
  }
};

export default function BoardHost({ campaignLoaded }: BoardHostProps) {
  const { boards, boardsById, closeBoard, setDock, setCollapsed, setRect, setDockSize } = useBoards();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [floatResizeState, setFloatResizeState] = useState<FloatResizeState | null>(null);
  const [dockResizeState, setDockResizeState] = useState<DockResizeState | null>(null);
  const [leftDockOrder, setLeftDockOrder] = useState<BoardId[]>([]);
  const [rightDockOrder, setRightDockOrder] = useState<BoardId[]>([]);
  const clearInteractionState = useCallback(() => {
    setDragState(null);
    setFloatResizeState(null);
    setDockResizeState(null);
  }, []);

  const openBoards = useMemo(() => boards.filter((board) => board.isOpen), [boards]);
  const leftDockBoards = useMemo(() => {
    const leftLiveIds = openBoards.filter((board) => board.dock === "left").map((board) => board.id);
    const orderedIds = mergeDockOrder(leftDockOrder, leftLiveIds);
    return orderedIds.map((id) => boardsById[id]).filter((board): board is BoardState => Boolean(board?.isOpen && board.dock === "left"));
  }, [boardsById, leftDockOrder, openBoards]);
  const rightDockBoards = useMemo(() => {
    const rightLiveIds = openBoards.filter((board) => board.dock === "right").map((board) => board.id);
    const orderedIds = mergeDockOrder(rightDockOrder, rightLiveIds);
    return orderedIds
      .map((id) => boardsById[id])
      .filter((board): board is BoardState => Boolean(board?.isOpen && board.dock === "right"));
  }, [boardsById, openBoards, rightDockOrder]);
  const floatingBoards = useMemo(() => openBoards.filter((board) => board.dock === "float"), [openBoards]);

  useEffect(() => {
    const leftLiveIds = openBoards.filter((board) => board.dock === "left").map((board) => board.id);
    setLeftDockOrder((previous) => {
      const next = mergeDockOrder(previous, leftLiveIds);
      return arrayEquals(previous, next) ? previous : next;
    });
    const rightLiveIds = openBoards.filter((board) => board.dock === "right").map((board) => board.id);
    setRightDockOrder((previous) => {
      const next = mergeDockOrder(previous, rightLiveIds);
      return arrayEquals(previous, next) ? previous : next;
    });
  }, [openBoards]);

  const reorderDockBoardByPointer = useCallback((dock: Exclude<Dock, "float">, draggedBoardId: BoardId, pointerY: number) => {
    const selector = `[data-dock-slot="${dock}"][data-board-id]`;
    const boardElements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (boardElements.length < 2) return;

    const orderedIds = boardElements
      .map((element) => element.dataset.boardId)
      .filter((value): value is BoardId => Boolean(value));
    const otherEntries = boardElements
      .map((element) => ({
        id: element.dataset.boardId as BoardId | undefined,
        mid: element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2,
      }))
      .filter((entry): entry is { id: BoardId; mid: number } => Boolean(entry.id && entry.id !== draggedBoardId));

    let insertIndex = otherEntries.findIndex((entry) => pointerY < entry.mid);
    if (insertIndex < 0) insertIndex = otherEntries.length;

    const reorder = (previous: BoardId[]) => {
      const filteredPrevious = previous.filter((id) => orderedIds.includes(id));
      const orderWithLiveIds = mergeDockOrder(filteredPrevious, orderedIds);
      const withoutDragged = orderWithLiveIds.filter((id) => id !== draggedBoardId);
      const clampedInsertIndex = Math.max(0, Math.min(insertIndex, withoutDragged.length));
      const next = [
        ...withoutDragged.slice(0, clampedInsertIndex),
        draggedBoardId,
        ...withoutDragged.slice(clampedInsertIndex),
      ];
      return arrayEquals(previous, next) ? previous : next;
    };

    if (dock === "left") {
      setLeftDockOrder(reorder);
      return;
    }
    setRightDockOrder(reorder);
  }, []);

  useEffect(() => {
    if (!dragState) return;

    const onMouseMove = (event: globalThis.MouseEvent) => {
      if ((event.buttons & 1) === 0) {
        setDragState(null);
        return;
      }

      const board = boardsById[dragState.id];
      if (!board) return;

      if (dragState.kind === "dock") {
        setDragState((previous) => {
          if (!previous || previous.kind !== "dock" || previous.id !== dragState.id) return previous;
          if (previous.clientX === event.clientX && previous.clientY === event.clientY) return previous;
          return {
            ...previous,
            clientX: event.clientX,
            clientY: event.clientY,
          };
        });

        reorderDockBoardByPointer(dragState.dock, dragState.id, event.clientY);

        if (dragState.dock === "left") {
          if (event.clientX > board.dockSize + UNDOCK_DISTANCE) {
            const width = clamp(board.rect.w, MIN_FLOAT_WIDTH, Math.max(MIN_FLOAT_WIDTH, window.innerWidth - 32));
            const height = clamp(board.rect.h, MIN_FLOAT_HEIGHT, Math.max(MIN_FLOAT_HEIGHT, window.innerHeight - 72));
            const nextX = clamp(event.clientX - Math.floor(width / 2), 8, window.innerWidth - width - 8);
            const nextY = clamp(event.clientY - 18, 48, window.innerHeight - height - 8);
            setDock(board.id, "float");
            setCollapsed(board.id, false);
            setRect(board.id, { x: nextX, y: nextY, w: width, h: height });
            setDragState({
              kind: "float",
              id: board.id,
              offsetX: event.clientX - nextX,
              offsetY: event.clientY - nextY,
            });
          }
          return;
        }

        if (event.clientX < window.innerWidth - board.dockSize - UNDOCK_DISTANCE) {
          const width = clamp(board.rect.w, MIN_FLOAT_WIDTH, Math.max(MIN_FLOAT_WIDTH, window.innerWidth - 32));
          const height = clamp(board.rect.h, MIN_FLOAT_HEIGHT, Math.max(MIN_FLOAT_HEIGHT, window.innerHeight - 72));
          const nextX = clamp(event.clientX - Math.floor(width / 2), 8, window.innerWidth - width - 8);
          const nextY = clamp(event.clientY - 18, 48, window.innerHeight - height - 8);
          setDock(board.id, "float");
          setCollapsed(board.id, false);
          setRect(board.id, { x: nextX, y: nextY, w: width, h: height });
          setDragState({
            kind: "float",
            id: board.id,
            offsetX: event.clientX - nextX,
            offsetY: event.clientY - nextY,
          });
        }
        return;
      }

      const snapLeft = event.clientX <= SNAP_DOCK_DISTANCE;
      const snapRight = window.innerWidth - event.clientX <= SNAP_DOCK_DISTANCE;
      if (snapLeft || snapRight) {
        setDock(board.id, snapLeft ? "left" : "right");
        setCollapsed(board.id, false);
        setDragState(null);
        return;
      }

      const nextX = clamp(event.clientX - dragState.offsetX, 8, window.innerWidth - board.rect.w - 8);
      const nextY = clamp(event.clientY - dragState.offsetY, 48, window.innerHeight - board.rect.h - 8);
      setRect(board.id, { ...board.rect, x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [boardsById, dragState, reorderDockBoardByPointer, setCollapsed, setDock, setRect]);

  useEffect(() => {
    if (!floatResizeState) return;

    const onMouseMove = (event: globalThis.MouseEvent) => {
      if ((event.buttons & 1) === 0) {
        setFloatResizeState(null);
        return;
      }

      const board = boardsById[floatResizeState.id];
      if (!board || board.dock !== "float") return;

      const maxWidth = Math.max(MIN_FLOAT_WIDTH, window.innerWidth - board.rect.x - 8);
      const maxHeight = Math.max(MIN_FLOAT_HEIGHT, window.innerHeight - board.rect.y - 8);
      const nextW = clamp(floatResizeState.startW + (event.clientX - floatResizeState.startX), MIN_FLOAT_WIDTH, maxWidth);
      const nextH = clamp(
        floatResizeState.startH + (event.clientY - floatResizeState.startY),
        MIN_FLOAT_HEIGHT,
        maxHeight
      );

      setRect(board.id, { ...board.rect, w: nextW, h: nextH });
    };

    const onMouseUp = () => {
      setFloatResizeState(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [boardsById, floatResizeState, setRect]);

  useEffect(() => {
    if (!dockResizeState) return;

    const onMouseMove = (event: globalThis.MouseEvent) => {
      if ((event.buttons & 1) === 0) {
        setDockResizeState(null);
        return;
      }

      const deltaX = event.clientX - dockResizeState.startX;
      const rawSize = dockResizeState.dock === "left" ? dockResizeState.startSize + deltaX : dockResizeState.startSize - deltaX;
      setDockSize(dockResizeState.id, clamp(rawSize, MIN_DOCK_SIZE, MAX_DOCK_SIZE));
    };

    const onMouseUp = () => {
      setDockResizeState(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dockResizeState, setDockSize]);

  useEffect(() => {
    const onWindowBlur = () => {
      clearInteractionState();
    };

    const onWindowMouseLeave = (event: globalThis.MouseEvent) => {
      if (event.relatedTarget) return;
      clearInteractionState();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearInteractionState();
    };

    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("mouseleave", onWindowMouseLeave);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("mouseleave", onWindowMouseLeave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clearInteractionState]);

  const onHeaderMouseDown = (board: BoardState) => (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cancelTabletopInteractions();

    if (board.dock === "float") {
      setDragState({
        kind: "float",
        id: board.id,
        offsetX: event.clientX - board.rect.x,
        offsetY: event.clientY - board.rect.y,
      });
      return;
    }

    const boardContainer = event.currentTarget.closest("[data-board-id]") as HTMLElement | null;
    const boardRect = boardContainer?.getBoundingClientRect();
    const fallbackWidth = board.dockSize;
    const fallbackHeight = board.isCollapsed ? 46 : 220;
    const width = boardRect?.width ?? fallbackWidth;
    const height = boardRect?.height ?? fallbackHeight;
    const left = boardRect?.left ?? (board.dock === "left" ? 12 : window.innerWidth - fallbackWidth - 12);
    const top = boardRect?.top ?? 56;

    setDragState({
      kind: "dock",
      id: board.id,
      dock: board.dock,
      offsetX: event.clientX - left,
      offsetY: event.clientY - top,
      clientX: event.clientX,
      clientY: event.clientY,
      width,
      height,
    });
  };

  const onStartFloatingResize = (board: BoardState) => (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cancelTabletopInteractions();
    setFloatResizeState({
      id: board.id,
      startX: event.clientX,
      startY: event.clientY,
      startW: board.rect.w,
      startH: board.rect.h,
    });
  };

  const onStartDockResize = (board: BoardState) => (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (board.dock === "float") return;
    cancelTabletopInteractions();
    setDockResizeState({
      id: board.id,
      dock: board.dock,
      startX: event.clientX,
      startSize: board.dockSize,
    });
  };

  const onPopOut = (boardId: BoardId) => {
    console.log(`[boards] pop-out requested: ${boardId}`);
  };

  return (
    <div style={hostStyle}>
      <div style={leftDockStyle}>
        {leftDockBoards.map((board) => (
          <div
            key={board.id}
            data-dock-slot="left"
            data-board-id={board.id}
            style={{
              width: board.dockSize,
              position: "relative",
              pointerEvents: "auto",
              visibility: dragState?.kind === "dock" && dragState.id === board.id ? "hidden" : "visible",
            }}
          >
            <BoardFrame
              board={board}
              isDragging={dragState?.kind === "dock" && dragState.id === board.id}
              onClose={() => closeBoard(board.id)}
              onToggleCollapse={() => setCollapsed(board.id, !board.isCollapsed)}
              onPopOut={() => onPopOut(board.id)}
              onHeaderMouseDown={onHeaderMouseDown(board)}
            >
              {getBoardContent(board.id, campaignLoaded)}
            </BoardFrame>
            <div
              onMouseDown={onStartDockResize(board)}
              style={{
                position: "absolute",
                top: 0,
                right: -3,
                width: 7,
                height: "100%",
                cursor: "ew-resize",
              }}
            />
          </div>
        ))}
      </div>

      <div style={rightDockStyle}>
        {rightDockBoards.map((board) => (
          <div
            key={board.id}
            data-dock-slot="right"
            data-board-id={board.id}
            style={{
              width: board.dockSize,
              position: "relative",
              pointerEvents: "auto",
              visibility: dragState?.kind === "dock" && dragState.id === board.id ? "hidden" : "visible",
            }}
          >
            <BoardFrame
              board={board}
              isDragging={dragState?.kind === "dock" && dragState.id === board.id}
              onClose={() => closeBoard(board.id)}
              onToggleCollapse={() => setCollapsed(board.id, !board.isCollapsed)}
              onPopOut={() => onPopOut(board.id)}
              onHeaderMouseDown={onHeaderMouseDown(board)}
            >
              {getBoardContent(board.id, campaignLoaded)}
            </BoardFrame>
            <div
              onMouseDown={onStartDockResize(board)}
              style={{
                position: "absolute",
                top: 0,
                left: -3,
                width: 7,
                height: "100%",
                cursor: "ew-resize",
              }}
            />
          </div>
        ))}
      </div>

      <div style={floatingLayerStyle}>
        {floatingBoards.map((board) => (
          <div
            key={board.id}
            style={{
              position: "absolute",
              left: board.rect.x,
              top: board.rect.y,
              width: board.rect.w,
              height: board.rect.h,
              pointerEvents: "auto",
            }}
          >
            <BoardFrame
              board={board}
              isDragging={dragState?.kind === "float" && dragState.id === board.id}
              style={{ height: "100%" }}
              onClose={() => closeBoard(board.id)}
              onToggleCollapse={() => setCollapsed(board.id, !board.isCollapsed)}
              onPopOut={() => onPopOut(board.id)}
              onHeaderMouseDown={onHeaderMouseDown(board)}
            >
              {getBoardContent(board.id, campaignLoaded)}
            </BoardFrame>
            <div
              onMouseDown={onStartFloatingResize(board)}
              style={{
                position: "absolute",
                right: 1,
                bottom: 1,
                width: 14,
                height: 14,
                cursor: "nwse-resize",
                borderRight: "2px solid rgba(175,190,220,0.8)",
                borderBottom: "2px solid rgba(175,190,220,0.8)",
                borderBottomRightRadius: 3,
              }}
            />
          </div>
        ))}

        {dragState?.kind === "dock" && boardsById[dragState.id] && (
          <div
            style={{
              position: "fixed",
              left: dragState.clientX - dragState.offsetX,
              top: dragState.clientY - dragState.offsetY,
              width: dragState.width,
              height: dragState.height,
              pointerEvents: "none",
              zIndex: 2205,
              opacity: 0.96,
            }}
          >
            <BoardFrame
              board={boardsById[dragState.id]}
              isDragging
              style={{ height: "100%" }}
              onClose={() => {}}
              onToggleCollapse={() => {}}
              onPopOut={() => {}}
              onHeaderMouseDown={() => {}}
            >
              {getBoardContent(dragState.id, campaignLoaded)}
            </BoardFrame>
          </div>
        )}
      </div>
    </div>
  );
}
