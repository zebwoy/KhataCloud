/**
 * ui/index.ts — KhataCloud Design System barrel export
 *
 * Import from '@/ui' or '../../ui' to get any component.
 *
 * Usage:
 *   import { Button, Badge, Input, Card, Modal } from '../ui';
 */

export { Button }                           from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input }                            from './Input';
export type { InputProps }                  from './Input';

export { Badge }                            from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Card, CardHeader, CardBody, CardFooter } from './Card';
export type { CardProps, CardVariant, CardSurface, CardPadding } from './Card';

export { Spinner, PageSpinner }             from './Spinner';
export type { SpinnerSize }                 from './Spinner';

export { Avatar }                           from './Avatar';
export type { AvatarProps, AvatarSize }     from './Avatar';

export { Alert }                            from './Alert';
export type { AlertProps, AlertVariant }    from './Alert';

export { Modal, ModalBody, ModalFooter }    from './Modal';
export type { ModalProps, ModalSize }       from './Modal';

export { Separator }                        from './Separator';
export type { SeparatorProps }              from './Separator';

export { Select }                           from './Select';
export type { SelectProps, SelectOption }   from './Select';
