/**
 * Barrel for the Pawgress primitive set.
 *
 * These are the components every feature builds on. Restyle them through the
 * design tokens in `app/globals.css` rather than forking their APIs — see
 * docs/design-system.md.
 */

export { Button, buttonStyles, type ButtonProps } from "./Button";
export { Card, CardHeader, CardTitle, CardBody, CardFooter, SectionLabel, Hairline } from "./Card";
export { Chip, ChipGroup, Tag, SourceChip, type SourceChipProps } from "./Chip";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ConfirmDialog,
  type ConfirmDialogProps,
} from "./Dialog";
export { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel } from "./Menu";
export {
  SegmentedNav,
  SegmentedNavItem,
  Avatar,
  type SegmentedNavItemProps,
  type AvatarProps,
} from "./Nav";
export { Field, Input, Textarea, Select, type FieldProps } from "./Field";
export {
  EmptyState,
  ErrorState,
  QuotaMeter,
  Skeleton,
  type EmptyStateProps,
  type ErrorStateProps,
  type QuotaMeterProps,
} from "./Feedback";
export { MasteryBar, type MasteryBarProps } from "./MasteryBar";
export { StatusBadge, statusLabel, type StatusBadgeProps } from "./StatusBadge";
