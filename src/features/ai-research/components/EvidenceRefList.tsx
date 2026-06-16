import type { ReactElement } from 'react';
import type { EvidenceRef } from '../../../lib/contracts/ai-research.types';
import { EvidenceList } from './EvidenceList';

export interface EvidenceRefListProps {
  readonly evidenceRefs: readonly EvidenceRef[];
}

export function EvidenceRefList({ evidenceRefs }: EvidenceRefListProps): ReactElement {
  return <EvidenceList evidence={evidenceRefs} />;
}
