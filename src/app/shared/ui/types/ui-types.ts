/**
 * Shared vocabulary for the RMS design-system primitives.
 *
 * Values are intentionally small closed unions: a primitive only accepts the
 * sizes, tones and states the system documents, so feature lanes cannot invent
 * a one-off variant.
 */

/** Control/row size. `xl` exists for the kitchen surface (56px actions). */
export type RmsSize = 'sm' | 'md' | 'lg' | 'xl';

/** Semantic status, mapped to the `--rms-<status>-*` token family. */
export type RmsStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Action emphasis. One primary action per view. Gold is fill only. */
export type RmsButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

/** Surface tone for cards and sections. */
export type RmsSurfaceTone = 'surface' | 'subtle' | 'sunken';

/** Padding step shared by card-like primitives. */
export type RmsPadding = 'none' | 'sm' | 'md' | 'lg';
