// Card States
export type CardState =
    | 'uncommitted'   // Captured, no decision made
    | 'confronting'   // In confrontation gate (not persisted)
    | 'executed'      // Execute chosen, timer active or completed
    | 'shadowed'      // Shadow chosen (open loop, deferred pressure)
    | 'discarded';    // Discard chosen (loop closed forever)

// SystemState reflects current load/clutter, not progress or rewards
export type SystemState =
    | 'void'            // 0 loops
    | 'stable'          // 1-3 loops
    | 'turbulent'       // 4-7 loops
    | 'critical'        // 8+ loops
    | 'focused'         // Active execute
    | 'deferred';       // High shadowed count (added pressure)

// User decisions during confrontation
export type Decision = 'execute' | 'shadow' | 'discard';

// Source types for captured content
export type SourceType = 'url' | 'text' | 'file';

// AI Categories
export type Category = 'Learning' | 'Tool' | 'Idea' | 'Content' | 'Reference' | 'Opportunity';


export interface Card {
    id: string;
    state: CardState;
    sourceType: SourceType;
    sourceContent: string;
    platformName?: string;
    extractedTitle?: string;

    // Timestamps
    createdAt: number;
    confrontedAt?: number;      // Last time confrontation started
    decidedAt?: number;         // When decision was made

    // AI Analysis
    aiSummary?: string;
    aiTitle?: string;
    aiTags?: string[];
    category?: Category;

    // Decision tracking
    decision?: Decision;
    totalConfrontations: number; // How many times user opened this card

    // Execute Mode fields
    executeStartedAt?: number;  // When timer was started
    executeDuration: number;    // Minutes (default 15)
    startAction?: string;       // First concrete step
    stopRule?: string;          // When can honestly stop
    allowedDomains?: string[];  // Whitelist for Focus Mode

    // Execute completion
    executeResult?: 'stopped' | 'aborted'; // stopped = closed, aborted = shadowed
}

export interface SystemMetrics {
    state: SystemState;
    uncommittedCount: number;
    shadowedCount: number;
    executingCount: number;
    totalOpenLoops: number;
    lastClosedAt?: number;      // Last discard or successful execute
}

// Helper: Calculate system state from cards
export function calculateSystemState(cards: Card[]): SystemState {
    const active = cards.filter(c =>
        c.state === 'uncommitted' ||
        c.state === 'shadowed' ||
        c.state === 'executed'
    );
    const executing = cards.filter(c => c.state === 'executed' && c.executeStartedAt);
    const shadowed = cards.filter(c => c.state === 'shadowed');

    // Priority: Focused
    if (executing.length > 0) return 'focused';

    // Priority: Deferred Tension (High shadow count)
    if (shadowed.length > 3) return 'deferred';

    const count = active.length;

    if (count === 0) return 'void';
    if (count <= 3) return 'stable';
    if (count <= 7) return 'turbulent';

    return 'critical';
}

// Helper: Format time since creation for Reality Check
export function formatTimeSince(createdAt: number): string {
    const now = Date.now();
    const diffMs = now - createdAt;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'just now';
}
