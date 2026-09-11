import type { Component, GroupBoundaryLayout, Position, SystemGroup } from './types';

export const DEFAULT_COMPONENT_SIZE = { width: 180, height: 72 } as const;
export const DEFAULT_GROUP_PADDING = { left: 32, right: 32, top: 56, bottom: 32 } as const;

type MemberGeometry = Position | { position: Position; size?: { width: number; height: number } };

function geometryOf(member: MemberGeometry) {
  if ('position' in member) return { position: member.position, size: member.size ?? DEFAULT_COMPONENT_SIZE };
  return { position: member, size: DEFAULT_COMPONENT_SIZE };
}

/** Fits a group around member boxes without changing any member positions. */
export function calculateGroupBounds(
  members: MemberGeometry[],
  padding = DEFAULT_GROUP_PADDING,
): GroupBoundaryLayout {
  if (!members.length) {
    return { position: { x: 0, y: 0 }, size: { width: padding.left + padding.right, height: padding.top + padding.bottom } };
  }
  const boxes = members.map(geometryOf);
  const minX = Math.min(...boxes.map(box => box.position.x));
  const minY = Math.min(...boxes.map(box => box.position.y));
  const maxX = Math.max(...boxes.map(box => box.position.x + box.size.width));
  const maxY = Math.max(...boxes.map(box => box.position.y + box.size.height));
  return {
    position: { x: minX - padding.left, y: minY - padding.top },
    size: { width: maxX - minX + padding.left + padding.right, height: maxY - minY + padding.top + padding.bottom },
  };
}

export const getGroupBounds = calculateGroupBounds;

export function getRelativeMemberPosition(position: Position, groupPosition: Position): Position {
  return { x: position.x - groupPosition.x, y: position.y - groupPosition.y };
}

export const toRelativePosition = getRelativeMemberPosition;

export function getAbsoluteMemberPosition(position: Position, groupPosition: Position): Position {
  return { x: position.x + groupPosition.x, y: position.y + groupPosition.y };
}

export function isMemberWithinGroup(
  group: Pick<SystemGroup, 'position' | 'size'> | GroupBoundaryLayout,
  position: Position,
  memberSize = DEFAULT_COMPONENT_SIZE,
  padding = DEFAULT_GROUP_PADDING,
): boolean {
  const minX = group.position.x + padding.left;
  const minY = group.position.y + padding.top;
  const maxX = group.position.x + group.size.width - padding.right - memberSize.width;
  const maxY = group.position.y + group.size.height - padding.bottom - memberSize.height;
  return position.x >= minX && position.y >= minY && position.x <= maxX && position.y <= maxY;
}

export const isPositionWithinGroup = isMemberWithinGroup;

/** Clamps a member's top-left position while retaining the membership. */
export function constrainMemberPosition(
  group: Pick<SystemGroup, 'position' | 'size'> | GroupBoundaryLayout,
  proposed: Position,
  memberSize = DEFAULT_COMPONENT_SIZE,
  padding = DEFAULT_GROUP_PADDING,
): Position {
  const minX = group.position.x + padding.left;
  const minY = group.position.y + padding.top;
  const maxX = Math.max(minX, group.position.x + group.size.width - padding.right - memberSize.width);
  const maxY = Math.max(minY, group.position.y + group.size.height - padding.bottom - memberSize.height);
  return { x: Math.min(Math.max(proposed.x, minX), maxX), y: Math.min(Math.max(proposed.y, minY), maxY) };
}

export const constrainPositionToGroup = constrainMemberPosition;

export function translateGroupWithMembers(
  group: Pick<SystemGroup, 'position'>,
  members: Array<Pick<Component, 'position'>>,
  delta: Position,
): { groupPosition: Position; memberPositions: Position[] } {
  return {
    groupPosition: { x: group.position.x + delta.x, y: group.position.y + delta.y },
    memberPositions: members.map(member => ({ x: member.position.x + delta.x, y: member.position.y + delta.y })),
  };
}

export const translateGroup = translateGroupWithMembers;

