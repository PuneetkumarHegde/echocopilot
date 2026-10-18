import { QuestionItem } from './types';

export const INITIAL_QUESTIONS: QuestionItem[] = [
  // --- JAVA ---
  {
    id: 'java-01',
    title: 'Explain ConcurrentHashMap Internal Architecture & Java 8 Optimizations',
    category: 'Java',
    difficulty: 'Hard',
    companies: ['Amazon', 'Google', 'Goldman Sachs'],
    roles: ['Backend Engineer', 'Senior Java Developer'],
    question: 'How does ConcurrentHashMap achieve thread-safety without locking the entire map? What changed from Java 7 segment locking to Java 8?',
    answerSummary: 'Java 8 ConcurrentHashMap replaces segment-based locks with node-level CAS (Compare-And-Swap) for empty buckets and synchronized blocks on bucket heads, converting bins to Red-Black trees when collisions exceed threshold 8.',
    keyPoints: [
      'Java 7 used 16 Segment locks (ReentrantLock) giving concurrency level of 16.',
      'Java 8 removed Segments. It uses lock-free CAS (Unsafe / VarHandle) to insert the first node in a bucket.',
      'If bucket has collisions, it synchronizes solely on the individual head node (Object monitor), dramatically reducing lock contention.',
      'Treeification: When bin count reaches TREEIFY_THRESHOLD (8) and table capacity >= 64, linked lists convert to balanced Red-Black trees (TreeNode), improving worst-case search from O(N) to O(log N).',
      'Reads (`get()`) are completely lock-free via volatile `val` and `next` pointers.'
    ],
    codeSnippet: {
      language: 'java',
      code: `// Simplified conceptual node insertion in Java 8+
final V putVal(K key, V value, boolean onlyIfAbsent) {
    int hash = spread(key.hashCode());
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            // Lock-free CAS insertion for first node
            if (casTabAt(tab, i, null, new Node<K,V>(hash, key, value)))
                break;
        } else {
            // Synchronize only on head node 'f' of the specific bucket
            synchronized (f) {
                if (tabAt(tab, i) == f) {
                    // Traverse chain or Red-Black Tree and insert
                }
            }
        }
    }
}`
    },
    complexity: {
      time: 'O(1) average lookup & insert, O(log N) worst-case with collisions (TreeBin)',
      space: 'O(N) heap memory with minimal locking overhead'
    },
    pitfalls: [
      'ConcurrentHashMap does not allow null keys or null values, unlike standard HashMap.',
      'Size operations (`size()`, `mappingCount()`) use LongAdder cell striping for high concurrency, returning an approximate estimate rather than an instantaneous snapshot.'
    ]
  },
  {
    id: 'java-02',
    title: 'Java Memory Model, Volatile Semantics & Happens-Before Guarantee',
    category: 'Java',
    difficulty: 'Medium',
    companies: ['Microsoft', 'Meta', 'Oracle'],
    roles: ['Backend Engineer', 'Systems Engineer'],
    question: 'What is the Java Memory Model (JMM)? How does the volatile keyword prevent CPU instruction reordering and guarantee memory visibility?',
    answerSummary: 'The JMM governs how threads interact through memory. The `volatile` keyword guarantees direct visibility of writes across threads and establishes a happens-before relationship using CPU memory barriers (LoadLoad, StoreStore, LoadStore, StoreLoad) preventing instruction reordering.',
    keyPoints: [
      'Visibility: Reads bypass L1/L2 thread CPU caches and fetch directly from main memory; writes flush immediately to main memory.',
      'Atomicity Limit: volatile guarantees visibility and 64-bit reference atomicity, but does NOT guarantee composite operations like `count++` (read-modify-write requires AtomicInteger or locks).',
      'Happens-Before: A write to a volatile variable happens-before every subsequent read of that same variable.',
      'Hardware level: Inserts memory fences/barriers (e.g. `mfence` or `lock addl` on x86) preventing compiler and CPU out-of-order execution.'
    ],
    codeSnippet: {
      language: 'java',
      code: `// Safe Double-Checked Locking Singleton using volatile
public class SafeDclSingleton {
    // volatile ensures write is visible and prevents reordering of constructor instructions
    private static volatile SafeDclSingleton instance;

    private SafeDclSingleton() { /* heavy initialization */ }

    public static SafeDclSingleton getInstance() {
        if (instance == null) { // 1st check without lock
            synchronized (SafeDclSingleton.class) {
                if (instance == null) { // 2nd check with lock
                    instance = new SafeDclSingleton(); 
                }
            }
        }
        return instance;
    }
}`
    },
    complexity: {
      time: 'Negligible read overhead compared to synchronized locks',
      space: 'O(1) memory overhead'
    },
    pitfalls: [
      'Omitting `volatile` in Double-Checked Locking can expose partially constructed objects to other threads due to memory reordering of (1) memory allocation, (2) constructor call, and (3) reference assignment.'
    ]
  },

  // --- SQL ---
  {
    id: 'sql-01',
    title: 'Window Functions: Cumulative Revenue & Ranking Without Self-Joins',
    category: 'SQL',
    difficulty: 'Medium',
    companies: ['Uber', 'Stripe', 'Amazon'],
    roles: ['Data Engineer', 'Backend Engineer', 'Analytics Engineer'],
    question: 'Write an optimized SQL query to calculate running 30-day cumulative revenue per department and identify top 3 earning departments per quarter.',
    answerSummary: 'Use ANSI SQL window functions `SUM() OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN)` for running totals and `DENSE_RANK() OVER (...)` in a Common Table Expression (CTE) to avoid expensive quadratic self-joins.',
    keyPoints: [
      'Window functions compute aggregates over row partitions without collapsing individual rows like `GROUP BY`.',
      'Framing: `ROWS BETWEEN 29 PRECEDING AND CURRENT ROW` controls precise sliding window calculation.',
      '`DENSE_RANK()` assigns contiguous rank integers without gaps in case of ties, ideal for "Top N" filtering.',
      'CTEs (`WITH ...`) allow query optimizers to materialize or push down projection predicates cleanly.'
    ],
    codeSnippet: {
      language: 'sql',
      code: `WITH MonthlyAggregates AS (
    SELECT 
        department_id,
        DATE_TRUNC('month', order_date) AS order_month,
        SUM(order_amount) AS total_revenue,
        -- Running cumulative sum over past months for this department
        SUM(SUM(order_amount)) OVER (
            PARTITION BY department_id 
            ORDER BY DATE_TRUNC('month', order_date)
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_cumulative_revenue,
        -- Rank departments within the given month
        DENSE_RANK() OVER (
            PARTITION BY DATE_TRUNC('month', order_date) 
            ORDER BY SUM(order_amount) DESC
        ) AS dept_rank
    FROM orders
    WHERE order_status = 'COMPLETED'
    GROUP BY department_id, DATE_TRUNC('month', order_date)
)
SELECT department_id, order_month, total_revenue, running_cumulative_revenue
FROM MonthlyAggregates
WHERE dept_rank <= 3
ORDER BY order_month DESC, dept_rank ASC;`
    },
    complexity: {
      time: 'O(N log N) dominated by window partition sorting, versus O(N^2) for self-joins',
      space: 'O(N) working memory for window buffer'
    },
    pitfalls: [
      'Confusing `ROWS BETWEEN` (physical row count) with `RANGE BETWEEN` (logical value range, e.g. date interval).',
      'Window functions cannot be placed directly inside `WHERE` clauses; you must wrap them in a subquery or CTE.'
    ]
  },
  {
    id: 'sql-02',
    title: 'ACID Isolation Levels, Phantom Reads & Optimistic vs Pessimistic Concurrency',
    category: 'SQL',
    difficulty: 'Hard',
    companies: ['Stripe', 'Coinbase', 'Meta'],
    roles: ['Database Engineer', 'Principal Architect'],
    question: 'Differentiate Read Committed, Repeatable Read, and Serializable. How does Postgres MVCC prevent non-repeatable reads compared to MySQL InnoDB Next-Key locking?',
    answerSummary: 'ACID isolation controls anomalies. Postgres uses Multi-Version Concurrency Control (MVCC) with snapshot isolation for Repeatable Read, creating read snapshots based on transaction IDs (xmin/xmax). MySQL InnoDB uses 2-Phase Locking with Gap/Next-Key locks to lock index record ranges.',
    keyPoints: [
      'Dirty Reads: Reading uncommitted changes (prevented in Read Committed+).',
      'Non-Repeatable Reads: Value of same row changes within transaction (prevented in Repeatable Read).',
      'Phantom Reads: New rows matching a query appear (prevented in Serializable or MySQL Repeatable Read with Next-Key Locks).',
      'Postgres MVCC: Writers never block readers; readers never block writers. In Repeatable Read, queries see the snapshot as of the transaction start.',
      'Optimistic Concurrency: `UPDATE ... WHERE version = 3` rollback on mismatch; best for read-heavy low-contention systems.'
    ],
    codeSnippet: {
      language: 'sql',
      code: `-- Optimistic Concurrency Control Pattern
UPDATE user_wallets
SET balance = balance - 150.00,
    version = version + 1,
    updated_at = NOW()
WHERE user_id = 'usr_8492' 
  AND balance >= 150.00 
  AND version = 4;

-- If rows affected == 0, application raises ConflictException and retries.`
    },
    complexity: {
      time: 'O(log N) B-Tree index lookup',
      space: 'O(1) memory overhead; requires background VACUUM to clean dead row tuples in Postgres'
    },
    pitfalls: [
      'Write Skew anomaly in Snapshot Isolation: Two transactions read same dataset, make decisions, and modify disjoint rows that violate a global invariant (requires Serializable isolation or `SELECT FOR UPDATE`).'
    ]
  },

  // --- DATA STRUCTURES & ALGORITHMS ---
  {
    id: 'dsa-01',
    title: 'Design an LRU Cache with O(1) Get and O(1) Put',
    category: 'Data Structures & Algorithms',
    difficulty: 'Medium',
    companies: ['Google', 'Meta', 'Microsoft', 'Amazon'],
    roles: ['Software Engineer', 'Senior Software Engineer'],
    question: 'Implement a Least Recently Used (LRU) Cache that supports `get(key)` and `put(key, value)` in strict O(1) time complexity.',
    answerSummary: 'Combine a Hash Map with a Doubly Linked List. The Hash Map provides O(1) lookup to list nodes; the Doubly Linked List enables O(1) removal, insertion at the head (most recently used), and eviction from the tail (least recently used).',
    keyPoints: [
      'Using dummy head and dummy tail nodes eliminates edge-case null checks during insertion and deletion.',
      '`get(key)`: If present, find node in Map, detach it from its current position, move to head, return value.',
      '`put(key, value)`: If exists, update value and move to head. If new, create node, insert at head, and store in Map. If capacity is exceeded, evict tail.prev from both linked list and Map.'
    ],
    codeSnippet: {
      language: 'typescript',
      code: `class DNode {
  key: number;
  val: number;
  prev: DNode | null = null;
  next: DNode | null = null;
  constructor(key: number, val: number) { this.key = key; this.val = val; }
}

export class LRUCache {
  private capacity: number;
  private map = new Map<number, DNode>();
  private head = new DNode(0, 0); // dummy head
  private tail = new DNode(0, 0); // dummy tail

  constructor(capacity: number) {
    this.capacity = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.map.get(key);
    if (!node) return -1;
    this.moveToHead(node);
    return node.val;
  }

  put(key: number, value: number): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.val = value;
      this.moveToHead(existing);
    } else {
      const newNode = new DNode(key, value);
      this.map.set(key, newNode);
      this.addNode(newNode);
      if (this.map.size > this.capacity) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.map.delete(lru.key);
      }
    }
  }

  private addNode(node: DNode): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: DNode): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToHead(node: DNode): void {
    this.removeNode(node);
    this.addNode(node);
  }
}`
    },
    complexity: {
      time: 'O(1) for both get and put operations guaranteed',
      space: 'O(capacity) auxiliary memory for HashMap and Doubly Linked List nodes'
    },
    pitfalls: [
      'Using a singly linked list prevents O(1) arbitrary node deletion because finding the predecessor requires O(N) traversal.',
      'Forgetting to delete the evicted node key from the Hash Map causes memory leaks and stale lookups.'
    ]
  },
  {
    id: 'dsa-02',
    title: 'Serialize and Deserialize a Binary Tree (Level-Order & Pre-Order)',
    category: 'Data Structures & Algorithms',
    difficulty: 'Hard',
    companies: ['Meta', 'Uber', 'Apple'],
    roles: ['Software Engineer', 'Full Stack Engineer'],
    question: 'Design an algorithm to serialize a binary tree to a compact string and deserialize it back into the identical tree structure.',
    answerSummary: 'Use recursive pre-order DFS with a delimiter and null-sentinel (e.g. "#"), or BFS queue-based level order. DFS pre-order is often most concise: root -> left -> right, storing null nodes explicitly so reconstitution requires only a single sequential pass.',
    keyPoints: [
      'Without storing null pointers, a single pre-order traversal cannot uniquely reconstruct a general binary tree (requires both in-order and pre-order).',
      'By recording explicit null tokens (`#`), a single traversal sequence unambiguously defines the tree.',
      'Deserialization reads tokens sequentially with an iterator/queue, creating roots and recursing left then right.'
    ],
    codeSnippet: {
      language: 'typescript',
      code: `function serialize(root: TreeNode | null): string {
  const result: string[] = [];
  function dfs(node: TreeNode | null) {
    if (!node) {
      result.push('#');
      return;
    }
    result.push(node.val.toString());
    dfs(node.left);
    dfs(node.right);
  }
  dfs(root);
  return result.join(',');
}

function deserialize(data: string): TreeNode | null {
  const tokens = data.split(',');
  let index = 0;
  function build(): TreeNode | null {
    if (index >= tokens.length || tokens[index] === '#') {
      index++;
      return null;
    }
    const node = new TreeNode(parseInt(tokens[index++], 10));
    node.left = build();
    node.right = build();
    return node;
  }
  return build();
}`
    },
    complexity: {
      time: 'O(N) time for serialization and O(N) for deserialization where N is total nodes',
      space: 'O(N) memory to store string tokens and recursion stack'
    },
    pitfalls: [
      'Large trees (>10,000 nodes) can trigger JavaScript call stack overflow with recursive DFS; use BFS queue or iterative DFS with an explicit stack for production scale.'
    ]
  },

  // --- CYBERSECURITY ---
  {
    id: 'sec-01',
    title: 'OAuth 2.0 PKCE Flow, JWT Token Security & XSS vs CSRF Mitigations',
    category: 'Cybersecurity',
    difficulty: 'Hard',
    companies: ['Google', 'Stripe', 'Okta', 'Cloudflare'],
    roles: ['Security Engineer', 'Staff Backend Engineer'],
    question: 'Why is Authorization Code flow with PKCE mandatory for Single Page Apps? Where should JWT access and refresh tokens be stored, and how do you protect them against XSS and CSRF?',
    answerSummary: 'PKCE (Proof Key for Code Exchange) protects authorization codes from interception in public clients without client secrets. Access tokens should be ephemeral in memory, while refresh tokens reside in `HttpOnly`, `SameSite=Strict`, `Secure` cookies to defend against malicious XSS script exfiltration.',
    keyPoints: [
      'PKCE Flow: Client generates random `code_verifier` and hashes it to `code_challenge` (SHA-256). Auth server validates hash upon code exchange, preventing authorization code injection.',
      'LocalStorage Vulnerability: Any XSS vulnerability (e.g. compromised third-party npm package) can execute `localStorage.getItem("token")` and exfiltrate keys to attacker C2 servers.',
      'Cookie Security Flags: `HttpOnly` prevents JS access; `SameSite=Strict` blocks cross-origin CSRF; `Secure` enforces TLS transmission.',
      'CSRF Protection: For state-modifying requests, use Anti-CSRF double-submit cookies or custom headers (e.g. `X-Requested-With`) which browser pre-flight CORS blocks cross-origin.'
    ],
    codeSnippet: {
      language: 'typescript',
      code: `// Secure Cookie Configuration for Refresh Tokens in Next.js / Express
response.cookies.set({
  name: '__Secure-refresh-token',
  value: encryptedRefreshToken,
  httpOnly: true,     // Inaccessible to document.cookie (Defends XSS)
  secure: true,       // Only transmitted over HTTPS
  sameSite: 'strict', // Never sent on cross-site requests (Defends CSRF)
  path: '/api/auth/refresh', // Scoped exclusively to refresh endpoint
  maxAge: 60 * 60 * 24 * 7 // 7 days expiration
});`
    },
    complexity: {
      time: 'O(1) cryptographic verification (HMAC-SHA256 or RS256)',
      space: 'O(1) memory overhead'
    },
    pitfalls: [
      'Never rely on base64-decoded JWT payload for authorization decisions without verifying the cryptographic signature against the JWKS public key.',
      'Beware the "alg: none" or RSA-to-HMAC public key substitution vulnerabilities in unpatched JWT libraries.'
    ]
  },
  {
    id: 'sec-02',
    title: 'SQL Injection Prevention, Parameterization & Zero-Trust Architecture',
    category: 'Cybersecurity',
    difficulty: 'Medium',
    companies: ['Amazon', 'Apple', 'JPMorgan'],
    roles: ['Full Stack Engineer', 'Application Security Engineer'],
    question: 'How do parameterized prepared statements stop SQL Injection at the database driver level? What are the core pillars of Zero-Trust Network Architecture?',
    answerSummary: 'Prepared statements separate SQL syntax compilation from user data values. The DB engine compiles the query tree before data placeholders are bound, rendering SQL metacharacters inert. Zero Trust operates on "Never Trust, Always Verify" using mutual TLS, continuous authentication, and least-privilege RBAC.',
    keyPoints: [
      'Prepared statements transmit SQL query structure and parameters in two distinct network protocol packets (e.g., MySQL `COM_STMT_PREPARE` and `COM_STMT_EXECUTE`).',
      'Dynamic input is treated strictly as literal literal values, never as executable SQL tokens.',
      'Zero Trust 3 Pillars: 1) Verify explicitly, 2) Use least privileged access, 3) Assume breach.',
      'Micro-segmentation: Workloads communicate via mTLS with ephemeral certificates (e.g. SPIFFE/SPIRE, Istio service mesh).'
    ],
    codeSnippet: {
      language: 'typescript',
      code: `// VULNERABLE TO SQLi:
// db.query(\`SELECT * FROM users WHERE email = '\${userInput}'\`);

// SECURE: Parameterized Query using binary protocol placeholder
const query = 'SELECT id, email, password_hash, role FROM users WHERE email = $1 AND is_active = $2';
const values = [userEmailInput, true];
const user = await pool.query(query, values);`
    },
    complexity: {
      time: 'O(1) statement preparation amortized across repeated executions',
      space: 'O(1) driver buffer'
    },
    pitfalls: [
      'Parameterized queries only protect data values. Identifiers like table names (`FROM $1`) or column sort directions (`ORDER BY $2`) cannot be parameterized and must be strictly safelisted.'
    ]
  },

  // --- BEHAVIORAL ---
  {
    id: 'beh-01',
    title: 'Handling Technical Disagreements with Senior Leadership or Peers (STAR)',
    category: 'Behavioral',
    difficulty: 'Medium',
    companies: ['Amazon', 'Google', 'Meta', 'Netflix'],
    roles: ['Senior Engineer', 'Lead / Staff Architect', 'Engineering Manager'],
    question: 'Tell me about a time you strongly disagreed with a senior engineer or engineering manager on a crucial architectural decision. How did you resolve it?',
    answerSummary: 'Demonstrate intellectual humility, data-driven prototyping, and the Amazon principle "Have Backbone; Disagree and Commit". Present structured metrics instead of emotional arguments.',
    keyPoints: [
      'Situation: Lead architect wanted to migrate monolithic database to distributed NoSQL (Cassandra), risking consistency and months of delay.',
      'Task: Validate whether Cassandra actually solved our latency bottlenecks without jeopardizing ACID transactional integrity.',
      'Action: Built a 3-day load test benchmark (JMeter/K6). Demonstrated that 92% of queries were complex relational joins and that adding read replicas + Redis caching achieved sub-15ms p99 with zero schema refactor.',
      'Result: Management agreed to keep PostgreSQL with Redis caching, delivering the project 2 months ahead of schedule and saving $80k/year in cloud licensing.'
    ],
    codeSnippet: {
      language: 'markdown',
      code: `### STAR Response Blueprint:
- **Situation:** "During our Q3 checkout redesign at my previous company, our team debated whether to rewrite the order workflow into microservices or optimize our modular monolith."
- **Task:** "I needed to ensure our upcoming Black Friday peak traffic wouldn't crash the database while avoiding an unproven distributed transaction rewrite."
- **Action:** "Rather than arguing theory, I spun up an empirical benchmark simulating 10x traffic. I presented latency graphs showing our bottleneck was missing composite indexes and connection pooling, not monolithic CPU."
- **Result:** "We implemented PgBouncer and optimized queries, scaling to 15,000 orders/minute without a single dropped transaction, saving 4 months of engineering effort."`
    },
    complexity: {
      time: '2 - 3 minute concise verbal response structure',
      space: 'High impact STAR framework'
    },
    pitfalls: [
      'Do not portray yourself as "the only smart person in the room". Highlight collaboration and constructive listening.',
      'Never skip the measurable Result (revenue, latency, uptime, or developer velocity metrics).'
    ]
  },
  {
    id: 'beh-02',
    title: 'Managing a Critical Production Outage Under Extreme Pressure',
    category: 'Behavioral',
    difficulty: 'Hard',
    companies: ['Meta', 'Uber', 'Stripe'],
    roles: ['DevOps / SRE', 'Staff Engineer', 'Engineering Lead'],
    question: 'Describe your most challenging production incident. How did you coordinate triage, communicate with stakeholders, and prevent recurrence?',
    answerSummary: 'Focus on systematic incident response: isolate blast radius, mitigate customer impact first before root-cause debugging, maintain transparent status updates, and conduct blameless post-mortems with preventative engineering controls.',
    keyPoints: [
      'Mitigate First, Debug Second: Roll back faulty deployment or disable feature flag rather than trying to hotfix live in production.',
      'Incident Command: Establish single Incident Commander (IC), dedicated communication channel, and regular 15-minute executive stakeholder briefs.',
      'Blameless Post-Mortem: Focus on systemic process and observability failures rather than human error.',
      'Action Items: Automated canary deployments, synthetic alerts, and circuit breakers.'
    ],
    codeSnippet: {
      language: 'markdown',
      code: `### Key Principles to Highlight:
1. "My top priority was stopping the financial bleeding: I activated our circuit breaker to degrade non-critical recommendations and rolled back the last canary pod within 4 minutes."
2. "I assigned myself as Communications Lead, posting updates every 15 minutes to our internal status page so engineers could focus on telemetry without interruptions."
3. "In the post-mortem, we added automated semantic database schema validations to our CI/CD pipeline, completely preventing that class of bug from reaching staging again."`
    },
    complexity: {
      time: '3 minute structured narrative',
      space: 'Demonstrates executive presence and composure'
    },
    pitfalls: [
      'Blaming a junior developer or third-party vendor. Ownership and systemic prevention are what interviewers look for.'
    ]
  },

  // --- SYSTEM DESIGN ---
  {
    id: 'sd-01',
    title: 'Design a Distributed Real-Time Collaborative Document Editor (Google Docs)',
    category: 'System Design',
    difficulty: 'Hard',
    companies: ['Google', 'Meta', 'Microsoft', 'Figma'],
    roles: ['Senior Software Engineer', 'Staff System Architect'],
    question: 'Design a real-time collaborative text editor supporting millions of concurrent users with offline editing, low-latency character synchronization, and conflict resolution.',
    answerSummary: 'Use Conflict-Free Replicated Data Types (CRDTs) like Yjs or Operational Transformation (OT) over WebSockets. Employ an event-driven architecture with Redis Pub/Sub for room messaging, Cassandra/DynamoDB for immutable change log storage, and S3 for periodic document snapshots.',
    keyPoints: [
      'Conflict Resolution: CRDTs (state-based or operation-based with Lamport timestamps) provide eventual consistency without a centralized lock server; OT requires central sequencing.',
      'Transport Layer: Dual-channel WebSockets with binary protocol (Protocol Buffers) for micro-deltas; HTTP/3 fallback.',
      'Session Scaling: Document ID hashed via Consistent Hashing to stateful WebSocket Gateway clusters.',
      'Persistence: Append-only delta log in distributed storage (ScyllaDB / Cassandra) + async snapshot worker saving compacted state to S3 every 100 edits.',
      'Offline Support: Local IndexedDB stores pending mutations and syncs vectors upon network reconnection.'
    ],
    codeSnippet: {
      language: 'mermaid',
      code: `graph TD
    Client1[Browser Client A] <-->|WebSocket ProtoBuf| Gateway[WebSocket Gateway / Envoy]
    Client2[Browser Client B] <-->|WebSocket ProtoBuf| Gateway
    Gateway <--> RedisCluster[Redis Pub/Sub & Presence Cluster]
    Gateway --> Worker[Collab Engine Worker / CRDT Resolver]
    Worker --> DeltaLog[(Cassandra Delta Log)]
    Worker --> SnapshotQueue[Kafka Snapshot Topic]
    SnapshotQueue --> SnapshotWorker[Compaction Service]
    SnapshotWorker --> S3[(AWS S3 Document Snapshots)]`
    },
    complexity: {
      time: '<50ms p99 cursor and character propagation latency',
      space: 'High write throughput with compacted snapshot tiering'
    },
    pitfalls: [
      'Relying on naive two-way diffing (diff-match-patch) which causes race conditions and lost keystrokes during simultaneous editing.',
      'Storing every raw keystroke in relational tables without compaction and snapshotting.'
    ]
  },
  {
    id: 'sd-02',
    title: 'Design a Globally Distributed Rate Limiter with Sub-Millisecond Overhead',
    category: 'System Design',
    difficulty: 'Medium',
    companies: ['Stripe', 'Cloudflare', 'Amazon', 'Uber'],
    roles: ['Backend Engineer', 'Infrastructure Architect'],
    question: 'Design an API rate limiter capable of enforcing tiered quota limits (e.g. 10,000 req/min per tenant) across multiple geographic cloud regions with minimal latency impact.',
    answerSummary: 'Implement the Sliding Window Counter algorithm using Redis Clusters with Lua scripts for atomic increments, or local memory in-process Token Bucket synchronized via batch aggregation to minimize cross-region network round trips.',
    keyPoints: [
      'Algorithms: Token Bucket (burst friendly), Leaky Bucket (smooth outflow), Sliding Window Counter (accurate, low memory).',
      'Storage: Redis Sorted Sets (ZSET) for precise sliding log, or Hash of time-bucket integers for memory efficiency.',
      'Multi-Region Latency Trade-off: Cross-region Redis calls add 100ms+. Solution: Local edge rate limiting with asynchronous batch credit allocation (local proxy consumes from local quota, replenishing every 500ms from global Redis).',
      'Headers: Return standard RFC headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`Retry-After\`.'
    ],
    codeSnippet: {
      language: 'lua',
      code: `-- Redis Lua Script for Atomic Sliding Window Counter Rate Limiter
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

-- Remove timestamps older than window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- Count current requests in window
local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
    -- Add current request timestamp
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, limit - currentRequests - 1} -- Allowed
else
    return {0, 0} -- Rejected (HTTP 429)
end`
    },
    complexity: {
      time: 'O(log M) per request where M is number of requests in current window',
      space: 'O(M) memory per client key'
    },
    pitfalls: [
      'Fixed Window Counter causes 2x burst exploit at boundary windows (e.g. 100 requests at 00:59 and 100 requests at 01:00).',
      'Race conditions: Never do separate Redis \`GET\` and \`INCR\` without Lua scripts or Redis Transactions (\`MULTI/EXEC\`).'
    ]
  }
];
