import { AnswerMode, CopilotAnswer, MockTurnFeedback, MockInterviewReport, ResumeAnalysisResult } from './types';

export async function generateOllamaAnswer(
  prompt: string,
  mode: AnswerMode = 'general',
  resumeContext = '',
  jobDescription = '',
  modelParam = '',
  urlParam = ''
): Promise<CopilotAnswer | null> {
  const trimmedLower = prompt.trim().toLowerCase();
  const hasQuestionMarker = /\b(what|how|why|explain|difference|describe|implement|define|tell me|code|solve)\b/i.test(trimmedLower);
  const isGreetingOnly = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|can you hear me|am i audible|testing|audio check|thanks|thank you)(\s+(punit|puneet|there|everyone|sir|team))?[.?!]?$/i.test(trimmedLower);

  // Quick bypass for simple greetings/audio checks to allow instant 1ms response
  if (!hasQuestionMarker && isGreetingOnly) {
    return null;
  }

  const baseOllama = urlParam || process.env.OLLAMA_API_URL || 'http://localhost:11434';
  const ollamaUrl = baseOllama.endsWith('/api/generate') ? baseOllama : `${baseOllama.replace(/\/$/, '')}/api/generate`;
  
  // Fast model selection: Use specified model directly without blocking on /api/tags
  let modelName = modelParam || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

  const systemPrompt = `You are a high-speed, real-time AI interview copilot for a live software engineering interview.
Mode: ${mode.toUpperCase()}.
${resumeContext ? `Candidate Background: ${resumeContext}\n` : ''}${jobDescription ? `Target Role: ${jobDescription}\n` : ''}Provide punchy, ultra-concise, technically flawless answers.
Return pure JSON matching this exact schema:
{
  "summary": "1 direct sentence delivering the core answer or concept",
  "spokenScript": "1-2 natural conversational sentences in first-person engineer voice for speaking out loud",
  "bullets": ["2-3 punchy bullet points with key mechanisms"],
  "codeSnippet": {
    "language": "python/java/typescript/sql",
    "code": "concise 3-7 line working code snippet or empty string if purely conceptual",
    "explanation": "1 short sentence",
    "timeComplexity": "O(...)",
    "spaceComplexity": "O(...)"
  },
  "tradeoffs": ["1 key engineering trade-off"]
}
No markdown backticks. Return pure JSON only.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: `${systemPrompt}\n\nCandidate Question: ${prompt}`,
        stream: false,
        format: 'json',
        options: {
          num_gpu: 99,
          num_thread: 8,
          num_ctx: 2048,
          num_predict: 320,
          temperature: 0.1
        },
        keep_alive: '60m'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(`[Ollama] HTTP ${resp.status} from ${ollamaUrl}`);
      return null;
    }

    const data = await resp.json();
    if (!data || !data.response) {
      return null;
    }

    const cleaned = data.response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const answer: CopilotAnswer = {
      id: 'ans_ollama_' + Math.random().toString(36).substring(2, 9),
      question: prompt,
      mode: mode as AnswerMode,
      summary: parsed.summary || 'Direct technical solution.',
      spokenScript: parsed.spokenScript || (parsed.summary ? `${parsed.summary}` : undefined),
      bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0
        ? parsed.bullets.map((b: any) => {
            if (typeof b === 'string') return b;
            if (b && typeof b === 'object') {
              return b.text ? `${b.text}: ${b.architecture || b.mechanism || ''}`.trim() : Object.values(b).filter(v => typeof v === 'string').join(' - ');
            }
            return String(b);
          })
        : [parsed.summary || 'Direct technical solution.'],
      codeSnippet: parsed.codeSnippet && parsed.codeSnippet.code ? {
        language: parsed.codeSnippet.language || 'java',
        code: parsed.codeSnippet.code,
        explanation: parsed.codeSnippet.explanation,
        timeComplexity: parsed.codeSnippet.timeComplexity,
        spaceComplexity: parsed.codeSnippet.spaceComplexity
      } : undefined,
      tradeoffs: Array.isArray(parsed.tradeoffs) 
        ? parsed.tradeoffs.map((t: any) => typeof t === 'string' ? t : (t.text || Object.values(t).filter(v => typeof v === 'string').join(' - ')))
        : undefined,
      starExample: parsed.starExample,
      timestamp: Date.now()
    };

    return answer;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Ollama] Local generation unavailable (${msg}). Gracefully falling back to local smart engine.`);
    return null;
  }
}

export function generateSmartCopilotAnswer(prompt: string, mode: AnswerMode = 'general'): CopilotAnswer {
  const p = prompt.toLowerCase();
  const id = 'ans_' + Math.random().toString(36).substring(2, 9);
  const now = Date.now();

  // -------------------------------------------------------------
  // 0. GREETINGS, AUDIO CHECKS & PLEASANTRIES (NOT CODING PROBLEMS!)
  // -------------------------------------------------------------
  const trimmedLower = prompt.trim().toLowerCase();
  const hasQuestionMarker = /\b(what|how|why|explain|difference|describe|implement|define|tell me|code|solve)\b/i.test(trimmedLower);
  const isGreetingOnly = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|can you hear me|am i audible|testing|audio check|thanks|thank you)(\s+(punit|puneet|there|everyone|sir|team))?[.?!]?$/i.test(trimmedLower);

  if (!hasQuestionMarker && isGreetingOnly) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: 'Conversational pleasantry or audio check from the interviewer.',
      spokenScript: 'Hello! Yes, I can hear you loud and clear. Excited to speak with you today, thank you for having me!',
      bullets: [
        'Acknowledge clearly: Confirm that their microphone and audio connection are crystal clear.',
        'Tone: Professional, enthusiastic, and relaxed.',
        'Pivot: Ready to transition smoothly into the technical questions.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0b. NETWORKING: LOCALHOST, PORT 3000 & WEB SERVERS
  // -------------------------------------------------------------
  if (p.includes('localhost') || p.includes('3000') || p.includes('port') || p.includes('127.0.0.1')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: 'localhost (loopback IP 127.0.0.1) refers to your own local computer, and port 3000 is the default TCP network socket port assigned to the local web development server.',
      spokenScript: 'localhost is the standard hostname that points back to your own machine (loopback IP 127.0.0.1) without sending traffic over the internet. The ":3000" is the specific TCP port where your web development server (like Next.js or Node) listens for requests. We use localhost:3000 so we can safely run, build, and test applications entirely on our local machine before deploying them to a public production domain.',
      bullets: [
        'Loopback Interface (127.0.0.1): localhost loops network traffic directly inside your operating system\'s TCP/IP stack without going through routers or Wi-Fi.',
        'Port 3000: An operating system network socket identifier. Port 3000 is the popular default convention for modern web frameworks like Next.js, React, Express, and Rails.',
        'Security & Privacy: Localhost dev servers bind strictly to your machine, keeping unfinished code and sensitive test data completely private.',
        'Production Contrast: In production, websites run on port 80 (HTTP) or 443 (HTTPS) behind public DNS domain names like yourcompany.com.'
      ],
      tradeoffs: [
        'Localhost provides instant Hot Module Replacement (HMR) and zero network latency, but lacks production scale, cloud databases, and real SSL certificates.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 1. JAVA: METHOD OVERLOADING
  // -------------------------------------------------------------
  if (p.includes('overload')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Method overloading in Java is compile-time (static) polymorphism where multiple methods within the same class share the identical name but have different parameter lists (different count, types, or order of parameters).',
      spokenScript: 'In simple terms, method overloading is when you have multiple methods in the same class with the exact same name, but with different parameters — like changing the count or data types. A common interview trap is trying to overload just by changing the return type — Java won\'t compile that because the compiler resolves which method to run at compile time based purely on the arguments passed. In production code, I use it constantly to provide convenient API methods like calculateTotal(items) and calculateTotal(items, discountCode).',
      bullets: [
        'Signature Requirements: Overloaded methods must differ in parameter count, parameter data types, or sequence of types. Modifying only the return type, access modifier (e.g. public vs private), or throws clause does NOT overload a method and triggers a compile-time error.',
        'Compile-Time Resolution (Early Binding): The compiler determines the exact method to call at compile time based on the static declared type of arguments, encoding the exact signature into the class constant pool.',
        'Widening vs Autoboxing Precedence: Java resolves ambiguous overloaded calls with a strict priority order: 1) Exact match, 2) Primitive widening (e.g. int -> long), 3) Autoboxing (e.g. int -> Integer), 4) Varargs (e.g. int...). Primitive widening always takes precedence over autoboxing.',
        'Overloading vs Overriding: Overloading happens in the same class at compile-time with different arguments; Overriding happens in a subclass at runtime with the identical signature using dynamic dispatch (vtable).'
      ],
      codeSnippet: {
        language: 'java',
        code: `public class Calculator {
    // 1. Overload by parameter count
    public int add(int a, int b) {
        return a + b;
    }
    public int add(int a, int b, int c) {
        return a + b + c;
    }

    // 2. Overload by parameter data type
    public double add(double a, double b) {
        return a + b;
    }

    // 3. Overload by parameter sequence
    public void print(String label, int value) {
        System.out.println(label + ": " + value);
    }
    public void print(int value, String label) {
        System.out.println(value + " " + label);
    }

    // COMPILE ERROR: Changing return type alone is NOT valid overloading!
    // public double add(int a, int b) { return (double)(a + b); }
}`
      },
      complexity: {
        time: 'O(1) dispatch at runtime; resolved completely at compile-time with zero virtual table overhead',
        space: 'O(1) memory footprint'
      },
      tradeoffs: [
        'Readability vs Ambiguity: Improves API consistency (e.g. Math.max for int, long, double) but overloading with varargs or null parameters can cause ambiguous invocation compiler errors.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 2. JAVA: METHOD OVERRIDING & POLYMORPHISM
  // -------------------------------------------------------------
  if (p.includes('overrid') || p.includes('polymorphism')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Method overriding in Java is runtime (dynamic) polymorphism where a subclass provides its own specific implementation of a method that is already defined in its superclass, resolved via the virtual method table (vtable).',
      spokenScript: 'Method overriding is dynamic runtime polymorphism. In plain English, a child class replaces the behavior of a method it inherited from its parent. The method name, return type, and arguments must match. The key technical detail interviewers look for is dynamic dispatch: Java uses the vtable to figure out the actual runtime object on the heap, not the reference type. I always annotate with @Override so the compiler catches any signature mistakes right away.',
      bullets: [
        'Signature Identity: Overriding methods must have the exact same name, return type (or covariant subtype), and parameter list as the superclass method.',
        'Rules: Subclass method cannot have more restrictive access (e.g. public in parent cannot become private in child). Subclass cannot declare broader checked exceptions.',
        'Dynamic Method Dispatch: Resolved at runtime based on the actual object instance type in heap memory using the invokevirtual JVM instruction.',
        '@Override Annotation: Best practice; tells the compiler to verify that the method actually overrides a superclass method, catching accidental typo bugs.'
      ],
      codeSnippet: {
        language: 'java',
        code: `class Animal {
    public void makeSound() {
        System.out.println("Generic animal sound");
    }
}

class Dog extends Animal {
    @Override // Enforces compile-time signature verification
    public void makeSound() {
        System.out.println("Woof! (Overridden at runtime)");
    }
}

// Runtime dynamic dispatch:
Animal myPet = new Dog(); // Polymorphic reference
myPet.makeSound(); // Prints "Woof!" via vtable lookup`
      },
      complexity: {
        time: 'O(1) vtable indirect pointer dereference at runtime',
        space: 'O(1) auxiliary space'
      },
      tradeoffs: [
        'Runtime Polymorphism allows open-closed extensibility, but incurs minor vtable cache-miss overhead compared to inlined static methods.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3. JAVA: INTERFACE VS ABSTRACT CLASS
  // -------------------------------------------------------------
  if (p.includes('abstract') || (p.includes('interface') && p.includes('class'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'An abstract class is an incomplete class that can hold state (instance fields), constructors, and partial implementations, supporting single inheritance. An interface defines a contract of behavior supporting multiple inheritance and static/default methods.',
      spokenScript: 'My mental model is simple: Use an abstract class when classes have an "is-a" relationship and need to share internal state, like instance variables or constructors. Use an interface when you want to define a contract of "can-do" capabilities across completely different classes — like Comparable or Runnable. A Java class can only extend one abstract class, but it can implement as many interfaces as it needs. Also remember Java 8 added default methods and Java 9 added private methods inside interfaces.',
      bullets: [
        'Multiple Inheritance: A Java class can implement multiple interfaces, but can extend only one abstract class.',
        'State and Fields: Abstract classes can have instance variables (mutable state) and constructors; interfaces can only have public static final constants.',
        'Default & Static Methods (Java 8+): Interfaces can provide default implementations using default keyword and static helper methods.',
        'Private Methods (Java 9+): Interfaces can have private helper methods to encapsulate repeated default method logic.',
        'Design Heuristic: Use an Abstract Class for an "is-a" relationship sharing internal state; use an Interface for a "can-do" peripheral capability (e.g. Comparable, Runnable).'
      ],
      codeSnippet: {
        language: 'java',
        code: `// 1. Abstract class for core identity & shared state
abstract class BaseVehicle {
    protected int speed; // State
    public BaseVehicle(int speed) { this.speed = speed; }
    abstract void accelerate(); // Must be implemented by child
}

// 2. Interface for capabilities
interface ElectricPowered {
    void chargeBattery();
    default void status() { System.out.println("Battery Ready"); }
}

// Subclass extends one abstract class and implements interfaces
class TeslaModel3 extends BaseVehicle implements ElectricPowered {
    public TeslaModel3() { super(0); }
    public void accelerate() { speed += 15; }
    public void chargeBattery() { System.out.println("Charging Supercharger..."); }
}`
      },
      complexity: {
        time: 'O(1) method invocation',
        space: 'O(1) memory overhead'
      },
      tradeoffs: [
        'Interfaces provide maximum loose coupling; Abstract classes provide code reuse of shared mutable fields and constructors.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3b. JAVA: JVM MEMORY MODEL & GARBAGE COLLECTION
  // -------------------------------------------------------------
  if (p.includes('garbage') || p.includes('jvm') || p.includes('metaspace') || (p.includes('java') && p.includes('memory'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'JVM memory divides into Thread-Shared areas (Heap and Metaspace) and Thread-Private areas (Stack, PC Registers, Native Method Stacks). Garbage Collection automatically reclaims unreferenced heap objects via generational collectors.',
      spokenScript: 'The way I break down JVM memory in production is: The Stack is private to each thread and stores primitive local variables and reference pointers. The Heap is shared by all threads and holds all actual instantiated objects. Garbage collection scans the heap to clean up unreferenced objects. Modern collectors like G1 and ZGC partition the heap into regions so they can hit tight pause-time targets like sub-millisecond pauses on large multi-gigabyte heaps.',
      bullets: [
        'Heap Generations: Young Generation (Eden + Survivor spaces S0/S1) holds short-lived objects collected via fast Minor GC; Old/Tenured Generation holds surviving long-lived objects collected via Major/Full GC.',
        'Metaspace (Java 8+): Replaced PermGen. Stored in native OS memory (not heap) to prevent java.lang.OutOfMemoryError: PermGen space, holding class metadata, method bytecode, and static references.',
        'Stack vs Heap: Stack stores primitive local variables and object reference pointers (LIFO per thread); Heap stores all instantiated objects dynamic memory.',
        'GC Collectors: G1 GC (Garbage-First) partitions heap into equal regions for predictable low latency (<200ms pause target); ZGC / Shenandoah achieve sub-millisecond pauses on terabyte heaps using concurrent colored pointers.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// JVM Memory Tuning Flags:
// -Xms4g -Xmx4g               // Fixed Heap size (avoids runtime resizing)
// -XX:+UseG1GC                // Use Garbage-First Collector
// -XX:MaxGCPauseMillis=200    // Soft target latency bound
// -XX:MetaspaceSize=256m      // Initial Metaspace allocation

public class MemoryDemo {
    public static void main(String[] args) {
        int localId = 42; // Allocated on the Thread's Stack frame
        String label = new String("Java Memory"); // Reference on Stack -> Object on Heap
    }
}`
      },
      complexity: {
        time: 'Allocation is O(1) via TLAB (Thread-Local Allocation Buffers); GC pause bound by collector algorithm',
        space: 'Heap bounded by -Xmx; Native OS memory bounded by physical RAM'
      },
      tradeoffs: [
        'Throughput vs Latency: Parallel GC maximizes raw batch throughput; G1 and ZGC trade slight CPU overhead for low, deterministic stop-the-world pause times.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3c. JAVA: MULTITHREADING, SYNCHRONIZED & VOLATILE
  // -------------------------------------------------------------
  if (p.includes('synchronized') || p.includes('volatile') || p.includes('deadlock') || (p.includes('thread') && p.includes('java'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Thread safety in Java requires managing mutual exclusion and visibility. synchronized provides both mutual exclusion and memory barriers; volatile provides visibility and ordering without locking.',
      spokenScript: 'When handling concurrency in Java, there are two separate problems: memory visibility and mutual exclusion. I use volatile when I just need visibility — it forces CPU caches to flush directly to main memory so other threads always see the latest write, but it does NOT make compound operations like count++ atomic. When I need mutual exclusion to prevent two threads from modifying state at the same time, I use synchronized blocks or ReentrantLock to acquire a monitor lock.',
      bullets: [
        'volatile Keyword: Guarantees reads/writes flush directly to main memory (preventing CPU L1/L2 cache staleness) and prevents instruction reordering via memory barriers. It does NOT guarantee atomicity for compound operations like count++.',
        'synchronized: Acquires an intrinsic lock (monitor) on the target object. Ensures mutual exclusion (only 1 thread executes the block) AND establishes a happens-before relationship for memory visibility.',
        'Lock Upgrades (JVM Biased -> Thin -> Fat): JVM monitors start as Biased locks (single thread), upgrade to Lightweight CAS spinlocks under mild contention, and inflate to Heavyweight OS mutexes under high contention.',
        'Deadlock Prevention: Deadlocks occur when 4 Coffman conditions hold (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait). Prevent them by enforcing a global, strict lock-ordering hierarchy or using tryLock() with timeouts.'
      ],
      codeSnippet: {
        language: 'java',
        code: `public class ThreadSafeCounter {
    private volatile boolean isRunning = true;
    private int count = 0;
    private final Object lock = new Object();

    public void increment() {
        synchronized (lock) { // Acquires object monitor
            count++; // Atomic read-modify-write within monitor
        }
    }

    public int getCount() {
        synchronized (lock) {
            return count;
        }
    }
}`
      },
      complexity: {
        time: 'Uncontended biased lock is ~1ns; contested OS mutex can take ~1-5 microseconds context-switch latency',
        space: 'O(1) memory'
      },
      tradeoffs: [
        'Coarse vs Fine Locking: Synchronizing whole methods reduces code complexity but hurts multi-core throughput; ReentrantLock and Concurrent structures improve scalability at the cost of design care.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3d. JAVA: STRING IMMUTABILITY & STRING POOL
  // -------------------------------------------------------------
  if (p.includes('string pool') || (p.includes('string') && p.includes('immutab')) || p.includes('stringbuilder')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Strings in Java are immutable objects backed by final byte[] arrays. String literals are cached in the String Constant Pool in the Heap to save memory, enabling safe multi-threaded sharing and hash code caching.',
      spokenScript: 'Strings in Java are completely immutable — once created, their underlying byte array cannot be changed. Java does this for security, thread safety, and so hash codes can be cached for HashMap efficiency. Because they never change, Java stores literal strings in the String Constant Pool to save memory. That is why literal comparisons with == are true, but new String() allocates a new object. For string concatenation inside loops, I always use StringBuilder to prevent creating thousands of short-lived garbage objects.',
      bullets: [
        'Immutability: The String class is marked final and its underlying character/byte array cannot be modified after construction. Any modification creates a brand new String object.',
        'String Constant Pool: A special hashtable in heap memory. String s = "abc" reuses an existing "abc" pool instance, whereas new String("abc") explicitly allocates a separate instance on heap.',
        'Security & Hash Caching: Because Strings are immutable, their hashCode is lazily computed once and cached (crucial for HashMap performance), and they can safely carry database passwords and network endpoints without tampering.',
        'StringBuilder vs StringBuffer: StringBuilder is non-synchronized and fast (best for single-threaded loop concatenation); StringBuffer has synchronized methods for thread safety.'
      ],
      codeSnippet: {
        language: 'java',
        code: `String s1 = "interview"; // Cached in String Constant Pool
String s2 = "interview"; // Reuses exact same pool reference
String s3 = new String("interview"); // New heap object

System.out.println(s1 == s2);      // TRUE (identical memory address)
System.out.println(s1 == s3);      // FALSE (different heap pointers)
System.out.println(s1.equals(s3));  // TRUE (value contents match)

// Efficient Concatenation in Loops:
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 1000; i++) {
    sb.append(i).append(","); // O(1) amortized append, no orphan objects
}
String result = sb.toString();`
      },
      complexity: {
        time: 's1 == s2 reference equality is O(1); equals() is O(N) where N is character length',
        space: 'Pool deduplication reduces memory from O(N * instances) to O(N)'
      },
      tradeoffs: [
        'Immutability ensures zero synchronization overhead when sharing Strings across threads, but naive concatenation (str += "x") inside loops produces O(N²) garbage allocations.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 4. POSTGRESQL / DATABASE: B-TREE VS GIN INDEXING
  // -------------------------------------------------------------
  if (p.includes('gin') || p.includes('b-tree') || p.includes('btree') || (p.includes('postgres') && p.includes('index')) || (p.includes('database') && p.includes('index'))) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'B-Tree is the default index optimized for scalar equality and range queries on sorted data; GIN (Generalized Inverted Index) is designed for multi-key composite structures like JSONB, arrays, and full-text search.',
      bullets: [
        'B-Tree (Balanced Tree): Best for scalar data with standard comparison operators (<, <=, =, >=, >, BETWEEN). Offers blazing-fast O(log N) lookups with minimal write/update overhead.',
        'GIN (Generalized Inverted Index): An inverted index that maps individual elements (words, keys, array items) to the list of heap rows (TIDs) containing them. Ideal for full-text search (tsvector @@ tsquery), array containment (&&, @>), and JSONB queries (@>).',
        'Write Amplification Trade-off: GIN indexes are substantially slower on writes/inserts than B-Trees because a single inserted row updates multiple entries in the GIN tree (mitigated by fastupdate=on pending lists).',
        'Index Size: GIN indexes can grow very large; for continuous sequential timestamps or append-only tables, B-Tree or BRIN (Block Range Index) is vastly superior.',
        'Practical Rule of Thumb: Use B-Tree for primary keys, foreign keys, timestamps, and numeric IDs; use GIN for tagging systems, unstructured JSONB documents, and search fields.'
      ],
      codeSnippet: {
        language: 'sql',
        code: `-- 1. B-Tree: Ideal for equality and range filtering on scalar columns
CREATE INDEX idx_orders_created_at ON orders USING btree (created_at DESC);
-- Query: SELECT * FROM orders WHERE created_at >= NOW() - INTERVAL '7 days';

-- 2. GIN: Ideal for searching inside arrays or JSONB documents
CREATE INDEX idx_products_tags ON products USING gin (tags);
-- Query: SELECT * FROM products WHERE tags @> ARRAY['electronics', 'sale'];

-- 3. GIN with jsonb_path_ops: 3x smaller & faster for JSONB containment
CREATE INDEX idx_users_metadata ON users USING gin (metadata jsonb_path_ops);
-- Query: SELECT * FROM users WHERE metadata @> '{"role": "admin", "active": true}';`
      },
      complexity: {
        time: 'B-Tree: O(log N) lookup; GIN: O(K log N) where K is number of search tokens',
        space: 'B-Tree: Compact O(N); GIN: O(N * M) where M is average tokens per row'
      },
      tradeoffs: [
        'Read Latency vs Write Throughput: GIN achieves sub-5ms multi-token lookups but imposes up to 5x-10x slower write amplification compared to B-Tree.',
        'Memory Footprint: B-Tree easily fits in shared_buffers cache; GIN requires careful maintenance_work_mem sizing during VACUUM reindexing.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 5. DISTRIBUTED SYSTEMS: RATE LIMITING
  // -------------------------------------------------------------
  if (p.includes('rate limit') || p.includes('token bucket') || p.includes('sliding window')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Implement a distributed sliding window counter rate limiter using Redis Clusters with atomic Lua scripts or local edge token buckets.',
      bullets: [
        'Algorithm Choice: Sliding Window Counter provides high accuracy and eliminates boundary burst vulnerabilities present in Fixed Window counters.',
        'Atomic Storage: Execute sliding log increments inside a single Redis Lua script to guarantee atomicity and avoid race conditions between GET and INCR.',
        'Multi-Region Scaling: Avoid cross-region Redis round-trips by running local edge proxies that sync batch quotas asynchronously every 500ms.',
        'HTTP Headers: Return standard RFC rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After.'
      ],
      codeSnippet: {
        language: 'lua',
        code: `-- Atomic Sliding Window Rate Limiter Lua Script in Redis
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local current = redis.call('ZCARD', key)

if current < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, limit - current - 1} -- Allowed
else
    return {0, 0} -- Rejected (HTTP 429)
end`
      },
      complexity: {
        time: 'O(log M) where M is number of requests in current window',
        space: 'O(M) memory per tracked client IP or API key'
      },
      tradeoffs: [
        'Strict Accuracy vs Latency: Redis ZSET requires O(M) memory; for ultra-high QPS, use approximated Token Bucket using just two integers in memory.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 6. DATA STRUCTURES: LRU CACHE
  // -------------------------------------------------------------
  if (p.includes('lru') || (p.includes('cache') && p.includes('least recently'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Combine a Hash Map with a Doubly Linked List to achieve strict O(1) time complexity for both get(key) and put(key, value).',
      bullets: [
        'Hash Map: Maps key -> Doubly Linked List node reference for O(1) instantaneous lookup.',
        'Doubly Linked List: Maintains usage ordering. Head stores the most recently used (MRU) node; tail stores the least recently used (LRU) node.',
        'Sentinel Nodes: Use dummy head and dummy tail nodes to eliminate edge-case null pointer checks during node detachment and insertion.',
        'Eviction: When size exceeds capacity, remove the node at tail.prev from both the linked list and the Hash Map.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `class DNode {
  key: number; val: number;
  prev: DNode | null = null;
  next: DNode | null = null;
  constructor(k: number, v: number) { this.key = k; this.val = v; }
}

class LRUCache {
  private cap: number;
  private map = new Map<number, DNode>();
  private head = new DNode(0, 0);
  private tail = new DNode(0, 0);

  constructor(capacity: number) {
    this.cap = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.map.get(key);
    if (!node) return -1;
    this.moveToHead(node);
    return node.val;
  }

  put(key: number, val: number): void {
    const node = this.map.get(key);
    if (node) {
      node.val = val;
      this.moveToHead(node);
    } else {
      const newNode = new DNode(key, val);
      this.map.set(key, newNode);
      this.addNode(newNode);
      if (this.map.size > this.cap) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.map.delete(lru.key);
      }
    }
  }

  private addNode(n: DNode) {
    n.prev = this.head; n.next = this.head.next;
    this.head.next!.prev = n; this.head.next = n;
  }
  private removeNode(n: DNode) {
    n.prev!.next = n.next; n.next!.prev = n.prev;
  }
  private moveToHead(n: DNode) {
    this.removeNode(n); this.addNode(n);
  }
}`
      },
      complexity: {
        time: 'O(1) strictly for get and put',
        space: 'O(capacity) auxiliary memory for Map and DNode objects'
      },
      tradeoffs: [
        'Time vs Space: Doubly linked list nodes consume 2 extra memory pointers per entry, but eliminate O(N) linear shifts.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 7. JAVA: CONCURRENTHASHMAP & CONCURRENCY
  // -------------------------------------------------------------
  if (p.includes('concurrenthashmap') || (p.includes('java') && p.includes('hashmap'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Java 8+ ConcurrentHashMap utilizes lock-free CAS (Compare-And-Swap) for empty bucket heads and synchronizes solely on individual bucket heads, converting bins to Red-Black trees at threshold 8.',
      bullets: [
        'Evolution from Java 7: Java 7 used 16 Segment locks; Java 8 removed segments in favor of fine-grained node-level synchronization.',
        'Lock-free Insert: If bucket is empty, it inserts via CAS (Unsafe / VarHandle) with zero lock overhead.',
        'Node-level Locking: Collisions synchronize solely on the individual head node of that bucket, leaving all other buckets accessible to concurrent threads.',
        'Treeification: Linked lists convert to balanced Red-Black trees (TreeNode) when bin items >= 8 and table capacity >= 64, keeping search worst-case O(log N).',
        'Reads: get() operations are completely lock-free via volatile value and next pointers.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// Conceptual Java 8+ ConcurrentHashMap insert logic
if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
    // Lock-free CAS insert into empty bin
    if (casTabAt(tab, i, null, new Node<K,V>(hash, key, value)))
        break;
} else {
    // Synchronize ONLY on head node 'f' of the specific bucket
    synchronized (f) {
        if (tabAt(tab, i) == f) {
            // Traverse list or insert into TreeBin (Red-Black tree)
        }
    }
}`
      },
      complexity: {
        time: 'O(1) average lookup/insert; O(log N) worst-case with collisions',
        space: 'O(N) with minimal thread contention metadata'
      },
      tradeoffs: [
        'Complexity vs Concurrency: Highly complex treeification and resizing, but scales linearly across hundreds of CPU cores.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 8. JAVASCRIPT & FRONTEND ECOSYSTEM
  // -------------------------------------------------------------
  if (p.includes('javascript') || /\bjs\b/i.test(prompt) || p.includes('closure') || p.includes('hoist') || p.includes('event loop')) {
    // 8a. Closures
    if (p.includes('closure')) {
      return {
        id,
        question: prompt,
        mode: 'coding',
        summary: 'A closure is the combination of a function bundled together with references to its surrounding lexical environment, allowing an inner function to retain access to outer variables even after the outer function has returned.',
        spokenScript: 'A closure happens when an inner function remembers and accesses variables from its outer enclosing scope, even after that parent function has finished executing. In production JavaScript, we use closures every day for data privacy — creating private state without classes — as well as in factory functions, debounce handlers, and event listeners. The runtime retains the lexical scope in heap memory as long as the inner function is referenced.',
        bullets: [
          'Lexical Scoping: JavaScript determines variable scope based on where functions are declared in source code, not where they are called.',
          'Data Encapsulation: Functions can expose methods that access encapsulated private variables, preventing external tampering.',
          'Memory Consideration: Variables captured in closures are not garbage-collected as long as the closure function remains reachable, which can cause memory leaks if attached to long-lived event listeners.',
          'Common Use Cases: Function currying, memoization, debounce/throttle utilities, and React custom hooks.'
        ],
        codeSnippet: {
          language: 'javascript',
          code: `function createBankAccount(initialBalance) {
  let balance = initialBalance; // Private variable encapsulated in closure

  return {
    deposit: (amount) => {
      balance += amount;
      return balance;
    },
    getBalance: () => balance // Retains access to 'balance'
  };
}

const account = createBankAccount(100);
console.log(account.deposit(50)); // 150
console.log(account.balance);     // undefined (Private!)`
        },
        complexity: {
          time: 'O(1) variable resolution up the scope chain',
          space: 'O(1) to O(V) heap memory for captured lexical scope'
        },
        tradeoffs: [
          'Encapsulation vs Memory: Provides clean private variables, but holding references in global closures prevents garbage collection.'
        ],
        timestamp: now
      };
    }

    // 8b. Hoisting
    if (p.includes('hoist')) {
      return {
        id,
        question: prompt,
        mode: 'coding',
        summary: 'Hoisting is JavaScript\'s compilation-phase behavior where variable and function declarations are allocated in memory before code execution. var is initialized to undefined; let and const are hoisted into the Temporal Dead Zone (TDZ).',
        spokenScript: 'Hoisting is often described as moving declarations to the top of the file, but under the hood, the JavaScript engine allocates memory for declarations during the compilation phase before running any code. Function declarations are fully hoisted with their body. Variables declared with var are hoisted and initialized to undefined. Variables declared with let and const are also hoisted, but placed in the Temporal Dead Zone — so accessing them before their declaration line throws a ReferenceError.',
        bullets: [
          'Function Declarations: Fully hoisted. You can call function foo() {} before its definition in the code.',
          'var Declarations: Hoisted and initialized with undefined. Accessing before declaration returns undefined, not a crash.',
          'let and const (TDZ): Hoisted into the Temporal Dead Zone. Accessing before assignment triggers a ReferenceError.',
          'Best Practice: Always use const by default and let when re-assignment is needed; avoid var to eliminate hoisting bugs.'
        ],
        codeSnippet: {
          language: 'javascript',
          code: `// Function declaration: Fully hoisted
greet(); // Works! Prints "Hello"
function greet() { console.log('Hello'); }

// var: Hoisted with undefined
console.log(a); // undefined (No crash)
var a = 10;

// let/const: Temporal Dead Zone (TDZ)
// console.log(b); // Throws ReferenceError: Cannot access 'b' before initialization
let b = 20;`
        },
        complexity: {
          time: 'O(1) compilation symbol table allocation',
          space: 'O(1) memory overhead'
        },
        timestamp: now
      };
    }

    // 8c. Event Loop & Asynchronous JS
    if (p.includes('event loop') || p.includes('microtask') || p.includes('macrotask')) {
      return {
        id,
        question: prompt,
        mode: 'coding',
        summary: 'The JavaScript Event Loop orchestrates single-threaded non-blocking execution by prioritizing synchronous Call Stack frames, then draining the entire Microtask Queue (Promises, queueMicrotask), and finally executing Macrotasks (setTimeout, setInterval, I/O).',
        spokenScript: 'JavaScript is single-threaded, meaning it has only one Call Stack executing code. To handle non-blocking asynchronous operations like network requests or timers, it relies on the Event Loop. When an async task finishes, its callback goes to a queue. The Event Loop prioritizes the Microtask queue — which handles Promises — and completely empties it before processing any Macrotask like setTimeout or DOM rendering. This is why Promise callbacks always fire before setTimeout(..., 0).',
        bullets: [
          'Call Stack: Synchronous execution frame; functions push on invocation and pop on return (LIFO).',
          'Microtask Queue (High Priority): Promise.then, queueMicrotask, MutationObserver. The engine drains the ENTIRE microtask queue before rendering or touching macrotasks.',
          'Macrotask Queue (Task Queue): setTimeout, setInterval, setImmediate, I/O events. Exactly ONE macrotask is processed per loop turn before checking microtasks again.',
          'Starvation Risk: An infinite loop of Promise.resolve().then(...) starves macrotasks and completely freezes UI rendering.'
        ],
        codeSnippet: {
          language: 'javascript',
          code: `console.log('1: Sync');

setTimeout(() => console.log('4: Macrotask (setTimeout)'), 0);

Promise.resolve().then(() => console.log('3: Microtask (Promise)'));

console.log('2: Sync');

// Execution Order:
// 1: Sync -> 2: Sync -> 3: Microtask (Promise) -> 4: Macrotask (setTimeout)`
        },
        complexity: {
          time: 'O(1) queue shift per dispatch',
          space: 'O(N) memory for callback queue frames'
        },
        tradeoffs: [
          'Single-threaded execution eliminates thread race conditions and deadlocks, but CPU-heavy synchronous calculations lock the UI unless offloaded to Web Workers.'
        ],
        timestamp: now
      };
    }

    // 8d. General JavaScript Definition & Overview
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'JavaScript is a high-level, single-threaded, dynamically-typed, JIT-compiled programming language that powers interactive web clients, modern SPAs, and server-side runtimes via Node.js and Bun.',
      spokenScript: 'JavaScript is a high-level, single-threaded, dynamically-typed programming language that serves as the core scripting language of the web. Under the hood, engines like Google Chrome\'s V8 compile it directly to machine code using Just-In-Time (JIT) compilation with Ignition and TurboFan. Even though it runs on a single main thread, it achieves non-blocking asynchronous concurrency using an Event Loop with a Call Stack, Microtasks for Promises, and Macrotasks for I/O. Today, via runtimes like Node.js and Bun, it powers both frontend browser UIs and backend distributed services.',
      bullets: [
        'V8 Engine Architecture: Modern JS engines execute code using a multi-tier pipeline: an interpreter (Ignition) for instant startup, and an optimizing JIT compiler (TurboFan) that optimizes hot code into native assembly.',
        'Concurrency & Event Loop: Single-threaded with non-blocking I/O. The Call Stack executes synchronous code, while asynchronous callbacks queue into Microtask (Promises) and Macrotask (setTimeout/fetch) queues.',
        'First-Class Functions: Functions are treated as first-class citizens — they can be stored in variables, passed as arguments, returned from other functions, and form closures.',
        'Prototype-based Inheritance: Objects inherit properties directly from other objects via the prototype chain (__proto__), rather than classical class blueprints.',
        'Cross-Platform Ecosystem: Standardized under ECMAScript (ES6+), running client-side in all browsers and server-side in Node.js, Deno, and Bun.'
      ],
      codeSnippet: {
        language: 'javascript',
        code: `// 1. Closures & First-Class Functions
const createMultiplier = (factor) => (value) => value * factor;
const double = createMultiplier(2);
console.log(double(5)); // 10

// 2. Non-blocking Async/Await
async function fetchUserData(userId) {
  try {
    const res = await fetch(\`/api/users/\${userId}\`);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}`
      },
      complexity: {
        time: 'O(1) execution for compiled hot paths via TurboFan JIT',
        space: 'Managed dynamic heap memory with generational Mark-and-Sweep Garbage Collection'
      },
      tradeoffs: [
        'Dynamic typing enables high developer velocity and rapid prototyping, but can allow runtime type errors without TypeScript. Single-threaded model avoids locks, but requires Web Workers for heavy CPU math.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 9. REACT & FRONTEND FRAMEWORKS
  // -------------------------------------------------------------
  if (p.includes('react') || p.includes('virtual dom') || p.includes('useeffect') || p.includes('usestate')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'React is a declarative, component-based JavaScript library for building user interfaces, utilizing a Virtual DOM and the Fiber reconciliation algorithm for high-performance selective rendering.',
      spokenScript: 'React is a component-based UI library based on declarative programming: you describe what the UI should look like for a given state, and React handles the DOM updates. Its core performance mechanism is the Virtual DOM and the Fiber reconciler. When state changes, React creates a new lightweight virtual tree, diffs it against the previous fiber tree using heuristic O(N) reconciliation, and commits only the minimal changed nodes to the real DOM. With React Hooks like useState and useEffect, we build clean functional components with predictable side-effect lifecycles.',
      bullets: [
        'Virtual DOM & Fiber Reconciler: React maintains an in-memory virtual representation of the DOM. It splits rendering work into incremental chunks that can be paused, prioritized, or aborted.',
        'Unidirectional Data Flow: Data flows strictly downward from parent to child via props, making application state changes predictable and easy to debug.',
        'React Hooks: Introduced in 16.8, hooks like useState, useEffect, useMemo, and useCallback allow functional components to manage local state, memoization, and side effects without classes.',
        'Server Components (RSC): Modern React renders components on the server without sending JavaScript bundle weight to the client, drastically improving initial page load.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);

    fetch(\`/api/users/\${userId}\`)
      .then(r => r.json())
      .then(data => { if (isSubscribed) setUser(data); })
      .finally(() => { if (isSubscribed) setLoading(false); });

    return () => { isSubscribed = false; }; // Cleanup prevents race conditions
  }, [userId]);

  if (loading) return <div>Loading user...</div>;
  return <div>Hello, {user?.name}</div>;
}`
      },
      complexity: {
        time: 'O(N) reconciliation diffing heuristic instead of O(N³) tree diff algorithm',
        space: 'O(N) memory for Fiber node trees'
      },
      tradeoffs: [
        'Virtual DOM abstraction adds slight memory overhead and re-render management complexity, but eliminates expensive manual direct DOM operations.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 10. TYPESCRIPT: STATIC TYPING & INTERFACES
  // -------------------------------------------------------------
  if (p.includes('typescript') || /\bts\b/i.test(prompt)) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'TypeScript is a statically-typed superset of JavaScript that compiles to plain JavaScript, providing compile-time type verification, interfaces, generics, and self-documenting codebases.',
      spokenScript: 'TypeScript adds a compile-time static type system on top of JavaScript. Everything valid in JavaScript is valid in TypeScript, but TypeScript introduces interfaces, type aliases, generics, and union types. The biggest benefit in production is catching errors — like undefined property access or invalid API payloads — at compile time before code ever hits production. At build time, the TypeScript compiler strips away all type annotations, leaving clean, standard JavaScript.',
      bullets: [
        'Compile-Time Type Safety: Type checking runs entirely during development and build time, producing zero runtime performance overhead.',
        'Interfaces vs Types: Interfaces support declaration merging and are optimized for object shapes and inheritance via extends. Types are more versatile for unions, primitives, and mapped types.',
        'Generics: Allow writing flexible, reusable code components while preserving exact type safety across function boundaries.',
        'Structural Typing: TypeScript uses duck typing — if an object has the required properties and types, it satisfies the type contract regardless of its explicit inheritance.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `// Generics and Discriminated Unions
type ApiResponse<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

interface User {
  id: number;
  email: string;
}

function handleResponse(res: ApiResponse<User>) {
  if (res.status === 'success') {
    console.log(res.data.email); // Type-safe: TS narrows to success
  } else {
    console.error(res.message);  // Type-safe: TS narrows to error
  }
}`
      },
      tradeoffs: [
        'Increases initial development setup and build compilation time, but dramatically reduces production runtime bugs and refactoring friction in large teams.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 11. PYTHON: CORE ARCHITECTURE & GIL
  // -------------------------------------------------------------
  if (p.includes('python') || p.includes('gil')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Python is a high-level, interpreted, dynamically-typed programming language emphasizing developer readability, powered by automatic reference counting memory management and the Global Interpreter Lock (GIL) in CPython.',
      spokenScript: 'Python is known for its clean syntax and massive ecosystem in backend web development, data engineering, and machine learning. In CPython, memory is managed via reference counting combined with a cyclical garbage collector. A classic interview topic is the Global Interpreter Lock (GIL) — a mutex that allows only one native thread to execute Python bytecode at a time. For I/O-bound operations, async/await or threading works well; for CPU-heavy tasks, we bypass the GIL using multiprocessing or native C extensions like NumPy.',
      bullets: [
        'CPython Memory Management: Reference counting automatically deallocates objects when count drops to zero; a cyclic garbage collector detects circular references across 3 generations.',
        'Global Interpreter Lock (GIL): Mutex protecting CPython internal memory structures. Pre-Python 3.13 free-threading builds require multiprocessing for true CPU multicore parallelism.',
        'Decorators & First-Class Functions: Python treats functions as first-class objects; decorators provide clean syntax (@decorator) to wrap and extend function behaviors.',
        'Generators & Iterators: Use the yield keyword to produce streams lazily, evaluating one item at a time with O(1) memory consumption.'
      ],
      codeSnippet: {
        language: 'python',
        code: `# Custom Decorator & Generator in Python
import time
from functools import wraps

def timing_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.4f}s")
        return result
    return wrapper

# Lazy Generator: O(1) memory consumption
def stream_large_dataset(limit):
    for i in range(limit):
        yield i * 2`
      },
      complexity: {
        time: 'Interpreted bytecode execution; JIT/native speed achievable via PyPy or NumPy',
        space: 'Automatic dynamic memory management'
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 12. REST APIS & WEB ARCHITECTURE
  // -------------------------------------------------------------
  if (p.includes('rest') || p.includes('restful') || p.includes('http method') || p.includes('idempotent')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'REST (Representational State Transfer) is an architectural style for stateless, client-server distributed hypermedia systems utilizing standard HTTP methods, uniform resource identifiers (URIs), and standardized status codes.',
      spokenScript: 'REST is an architectural pattern for designing web APIs centered around resources. The key constraints are client-server decoupling, statelessness — meaning each request must contain all the information necessary to process it without server session state — and a uniform interface. We map operations to standard HTTP verbs: GET for safe retrieval, POST for creation, PUT for full replacement, PATCH for partial updates, and DELETE. A key concept interviewers look for is idempotency: GET, PUT, and DELETE are idempotent because executing them multiple times produces the identical server state.',
      bullets: [
        'Statelessness: Server never stores client session state. Enables effortless horizontal scaling behind load balancers.',
        'HTTP Verbs & Idempotency: GET, PUT, DELETE, and HEAD are idempotent. POST is non-idempotent because multiple calls create multiple records.',
        'HTTP Status Codes: 2xx (Success), 3xx (Redirection), 4xx (Client errors like 400 Bad Request, 401 Unauthorized, 404 Not Found), 5xx (Server errors like 500 Internal Error, 503 Service Unavailable).',
        'Resource-Oriented URIs: Use plural nouns rather than verbs (e.g. GET /api/v1/orders/123 instead of /api/getOrder).'
      ],
      codeSnippet: {
        language: 'json',
        code: `// Standard RESTful Endpoint Contract
// GET /api/v1/users/42
{
  "id": 42,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "createdAt": "2026-01-15T08:00:00Z"
}`
      },
      tradeoffs: [
        'REST is simple, standardized, and universally cached via HTTP, but can suffer from over-fetching or under-fetching compared to GraphQL for complex nested UI graphs.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 13. SQL VS NOSQL & DATABASE ARCHITECTURE
  // -------------------------------------------------------------
  if (p.includes('sql') || p.includes('nosql') || p.includes('database') || p.includes('rdbms')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'SQL relational databases enforce structured schemas, ACID transactions, and relational integrity with vertical scaling; NoSQL databases provide flexible unstructured schemas, horizontal partitioning, and eventual consistency.',
      spokenScript: 'The choice between SQL and NoSQL comes down to data consistency versus scaling model. SQL databases like PostgreSQL are relational, enforce strict schemas, support complex relational joins, and guarantee strict ACID consistency — making them the gold standard for transactional systems like payments and core user entities. NoSQL databases like MongoDB, DynamoDB, or Cassandra sacrifice complex joins in favor of flexible schema designs and horizontal partitioning across clusters, which is ideal for high-throughput write streams, unstructured documents, or global key-value caching.',
      bullets: [
        'Data Model: SQL uses normalized tables with foreign keys; NoSQL uses Key-Value (Redis), Document (MongoDB), Column-Family (Cassandra), or Graph (Neo4j).',
        'Transactions: SQL provides strong ACID transactions; NoSQL often follows the BASE model (Basically Available, Soft state, Eventual consistency).',
        'Scaling: SQL scales primarily vertically with read replicas; NoSQL shards and partitions horizontally across commodity servers.',
        'Indexing: B-Tree and B+Tree indexes power O(log N) searches in relational engines; LSM trees optimize write-heavy NoSQL databases.'
      ],
      tradeoffs: [
        'Choose SQL when relationships, data integrity, and ACID transactions are paramount. Choose NoSQL when horizontal write throughput, flexible schemaless documents, or massive data volume exceeds single-node storage.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 14. OOP PRINCIPLES (4 PILLARS & SOLID)
  // -------------------------------------------------------------
  if (p.includes('oop') || p.includes('object oriented') || p.includes('encapsulation') || p.includes('pillars of oop') || p.includes('solid')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Object-Oriented Programming (OOP) is structured around four foundational pillars: Encapsulation, Abstraction, Inheritance, and Polymorphism, guided by SOLID principles for maintainable system design.',
      spokenScript: 'The four core pillars of Object-Oriented Programming are Encapsulation, Abstraction, Inheritance, and Polymorphism. Encapsulation is bundling data and methods together while restricting direct access to internal state. Abstraction is hiding internal complexity and exposing only essential interfaces. Inheritance lets a child class reuse and extend code from a parent class. Polymorphism allows objects of different types to be treated through a common interface, handled at compile time via overloading or at runtime via overriding. In production, we balance these with composition over inheritance.',
      bullets: [
        'Encapsulation: Bundling fields and methods within a class, hiding internal representation using access modifiers (private/protected).',
        'Abstraction: Exposing clean public interfaces while hiding implementation complexity (e.g. Java interface or abstract class).',
        'Inheritance: Code reuse and hierarchical modeling ("is-a" relationship) from superclasses to subclasses.',
        'Polymorphism: "Many forms" — Static polymorphism via method overloading, and Dynamic polymorphism via method overriding with dynamic dispatch.',
        'SOLID Principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// Polymorphism & Encapsulation Example
public abstract class PaymentProcessor {
    private String merchantId; // Encapsulated private field

    public PaymentProcessor(String merchantId) {
        this.merchantId = merchantId;
    }
    // Abstraction: Contract to implement
    public abstract boolean processPayment(double amount);
}

public class StripeProcessor extends PaymentProcessor {
    public StripeProcessor(String merchantId) { super(merchantId); }

    @Override // Polymorphic runtime dispatch
    public boolean processPayment(double amount) {
        System.out.println("Processing $" + amount + " via Stripe");
        return true;
    }
}`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 15. DOCKER & CONTAINERIZATION
  // -------------------------------------------------------------
  if (p.includes('docker') || p.includes('container') || p.includes('kubernetes')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Docker provides lightweight operating-system-level virtualization using Linux namespaces and control groups (cgroups), packaging applications and dependencies into immutable portable containers.',
      spokenScript: 'Docker packages an application and all its dependencies into an immutable container image that runs identically across development, staging, and production. Unlike traditional Virtual Machines that require a full guest operating system on top of a hypervisor, Docker containers share the host Linux kernel. It isolates processes using Linux namespaces for PID, network, and mount points, and uses cgroups to allocate CPU and memory limits. This makes containers start in seconds with near-zero overhead.',
      bullets: [
        'Containers vs VMs: VMs virtualize hardware with a hypervisor and full guest OS (gigabytes in size, minutes to boot). Containers share the host kernel (megabytes in size, sub-second boot).',
        'Linux Primitives: Namespaces provide isolation (process tree, networking, filesystem mounts); Cgroups enforce hardware resource quotas (CPU, RAM).',
        'Image Layers: Docker images are composed of read-only cached filesystem layers created by Dockerfile instructions, topped with a thin writable container layer.',
        'Orchestration: Kubernetes orchestrates multi-container workloads across clusters, handling automated rollouts, service discovery, and auto-scaling.'
      ],
      codeSnippet: {
        language: 'dockerfile',
        code: `# Production Multi-stage Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 16. GIT & VERSION CONTROL (REBASE VS MERGE)
  // -------------------------------------------------------------
  if (p.includes('git') || p.includes('rebase') || p.includes('merge')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: 'Git is a distributed version control system. git merge combines branch histories by creating a new merge commit; git rebase rewrites branch history linearly onto the tip of the target branch.',
      spokenScript: 'The choice between git merge and git rebase is about commit history cleanliness versus complete historical accuracy. git merge is non-destructive: it takes two branches and combines them with a new 3-way merge commit, preserving the exact chronological sequence of when commits happened. git rebase, on the other hand, rewrites history by moving the base of your feature branch to the latest commit of main, giving you a clean, linear commit history without cluttering merge commits. The golden rule is: never rebase public shared branches.',
      bullets: [
        'git merge: Preserves true historical context and branch topology. Creates an explicit merge commit with multiple parent commits.',
        'git rebase: Replays your commits one by one onto the new base commit, creating a linear history. Ideal for cleaning up local feature branches before opening a PR.',
        'Golden Rule of Rebase: Never rebase commits that have already been pushed to a public/shared branch, as it changes commit hashes and forces upstream team members to resolve merge conflicts.',
        'Squash and Merge: Combines all feature commits into a single clean commit on main, giving the best of both worlds.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 17. CANDIDATE INTRODUCTION / "TELL ME ABOUT YOURSELF" / "PUNIT"
  // -------------------------------------------------------------
  if (
    p.includes('tell me about yourself') ||
    p.includes('introduce yourself') ||
    p.includes('who are you') ||
    p.includes('walk me through your resume') ||
    (p.includes('punit') && (p.includes('intro') || p.includes('who') || p.includes('about')))
  ) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: 'High-impact 60-second professional introduction highlighting full-stack engineering expertise, core stack, major achievements, and role alignment.',
      spokenScript: 'Hi! I am a Full-Stack Software Engineer with strong experience architecting and shipping scalable, high-performance web applications and distributed backend systems. My core technical stack centers around modern JavaScript/TypeScript, React, Node.js, and Java/Python, alongside relational and NoSQL databases. In my work, I focus on building end-to-end features — from responsive, accessible frontends to resilient, low-latency microservices with clean API design. I place a huge emphasis on code quality, automated testing, and observability. I am excited to bring my engineering background to this team and contribute directly to your product goals.',
      bullets: [
        'Present: Current technical role, core tech stack (React, Node.js, Java, TypeScript, Cloud).',
        'Past: Tangible achievements in improving performance, reducing latency, and scaling systems.',
        'Future: Why you are passionate about this specific company and position.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 18. DATABASE: ACID TRANSACTIONS & ISOLATION
  // -------------------------------------------------------------
  if (p.includes('acid') || p.includes('transaction') || p.includes('isolation level') || p.includes('mvcc')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'ACID guarantees database reliability. Modern engines like PostgreSQL achieve high concurrent isolation via Multi-Version Concurrency Control (MVCC) where writers never block readers and readers never block writers.',
      spokenScript: 'ACID stands for Atomicity, Consistency, Isolation, and Durability — the four guarantees that ensure reliable database transactions. Atomicity ensures all operations in a transaction succeed or all roll back. Consistency maintains schema constraints and invariants. Isolation controls concurrent visibility across four ANSI levels — Read Uncommitted, Read Committed, Repeatable Read, and Serializable. In production engines like PostgreSQL, this is implemented using MVCC (Multi-Version Concurrency Control), allowing readers to never block writers and writers to never block readers.',
      bullets: [
        'Atomicity: All operations succeed or whole transaction rolls back (enforced via Write-Ahead Log / WAL).',
        'Consistency: Preserves declared database constraints (foreign keys, check constraints, unique indexes).',
        'Isolation: Controls visibility of uncommitted writes across 4 ANSI levels: Read Uncommitted, Read Committed, Repeatable Read, and Serializable.',
        'Durability: Committed transactions persist to non-volatile disk storage even in power loss (fsync on WAL).',
        'Anomalies Prevented: Dirty reads (Read Committed+), Non-repeatable reads (Repeatable Read+), Phantom reads & Write Skew (Serializable).'
      ],
      codeSnippet: {
        language: 'sql',
        code: `-- Bank Account Transfer with ACID Transaction
BEGIN;

-- Read and lock sender row to prevent concurrency race condition
SELECT balance FROM accounts WHERE id = 101 FOR UPDATE;

UPDATE accounts SET balance = balance - 500 WHERE id = 101;
UPDATE accounts SET balance = balance + 500 WHERE id = 202;

-- If any step fails, ROLLBACK; else:
COMMIT;`
      },
      complexity: {
        time: 'O(log N) index access + O(1) WAL append',
        space: 'O(1) memory overhead; requires background VACUUM in Postgres to purge dead row versions'
      },
      tradeoffs: [
        'Strict Isolation vs Throughput: Serializable guarantees zero anomalies but incurs abort/retry overhead on serialization failures (HTTP 40001).'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 19. SYSTEM DESIGN / ARCHITECTURE FALLBACK
  // -------------------------------------------------------------
  if (mode === 'system_design' || p.includes('design') || p.includes('scale') || p.includes('distributed') || p.includes('architecture') || p.includes('microservice') || p.includes('kafka')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Adopt a horizontally scalable, event-driven microservices architecture with an API gateway, multi-tier distributed caching, and partitioned database storage.',
      spokenScript: 'When architecting this system, I start by clarifying scale: read vs write ratios, latency SLAs, and data durability. I would place an API gateway in front for rate limiting and SSL termination, backed by stateless microservices. For high read throughput, I use Redis cache with a Cache-Aside pattern. For heavy asynchronous writes, an event log like Kafka decouples downstream workers. Finally, we partition the database horizontally once single-node IOPS saturate.',
      bullets: [
        'Scale Estimation: Clarify traffic bounds (e.g. 50M DAU, 10k QPS read, 1k QPS write, 99.99% uptime SLA, p99 latency < 100ms).',
        'API Gateway & Ingress: Envoy or Kong terminates TLS, enforces token-bucket rate limiting, and routes to backend microservices.',
        'Caching Tier: Redis Cluster using Cache-Aside pattern with TTL jitter to eliminate cache stampedes.',
        'Database Tier: Relational PostgreSQL primary/read-replicas; partitioned horizontally by tenant_id via consistent hashing when single-node write IOPS saturate.',
        'Asynchronous Decoupling: Apache Kafka event topics handle asynchronous writes, analytics, and notification fanout.'
      ],
      tradeoffs: [
        'CAP Theorem: Balance strong consistency (CP) for billing/payments against high availability (AP) for user feeds and telemetry.',
        'Sync REST vs Event Bus: Synchronous HTTP calls increase cascading failure risk; use circuit breakers and async messaging for resilience.'
      ],
      timestamp: now
    };
  }

  // Dedicated Array vs ArrayList concept handler
  if (p.includes('array') && (p.includes('arraylist') || p.includes('array list') || p.includes('difference between array') || p.includes('vs'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'An Array is a fixed-size, contiguous memory structure supporting primitives directly, while an ArrayList is a dynamic, resizable collection wrapper backed by an array.',
      spokenScript: 'The primary difference is fixed versus dynamic sizing. Arrays have a fixed capacity allocated at creation and hold primitives with zero memory overhead. An ArrayList dynamically resizes when full and integrates with the Collections API, but only stores object references and incurs slight resizing cost.',
      bullets: [
        'Sizing: Arrays have fixed capacity determined at creation; ArrayList automatically grows dynamically (typically +50%) when capacity is reached.',
        'Data Types: Arrays support both primitives (int, char) and objects directly; ArrayList supports only object types via boxing (Integer, Character).',
        'Memory Efficiency: Arrays are memory-efficient with direct contiguous memory; ArrayList requires extra heap overhead for wrapper objects.',
        'Operations: Both offer O(1) random access by index; ArrayList provides convenient helper methods (add, remove, contains).'
      ],
      codeSnippet: {
        language: 'java',
        code: `// 1. Fixed-size primitive Array\nint[] arr = new int[5];\narr[0] = 42;\n\n// 2. Dynamic resizable ArrayList\nList<Integer> list = new ArrayList<>();\nlist.add(42);\nlist.add(99); // Automatically resizes as elements are added`,
        explanation: 'Use primitive arrays for high-throughput, fixed-size performance; use ArrayList for dynamic business data collections.',
        timeComplexity: 'O(1) index access for both; O(1) amortized add for ArrayList',
        spaceComplexity: 'O(N) contiguous memory'
      },
      tradeoffs: [
        'Memory vs Flexibility: Arrays consume minimal memory but cannot grow; ArrayList handles automatic reallocation at the cost of heap overhead.',
        'Primitives vs Autoboxing: Arrays eliminate heap allocation for primitives, whereas ArrayList incurs autoboxing and pointer chasing.'
      ],
      timestamp: Date.now()
    };
  }

  // -------------------------------------------------------------
  // 20. GENERAL CODING / ALGORITHM PROBLEM (When requested)
  // -------------------------------------------------------------
  const isCodingQuestion = 
    mode === 'coding' && 
    (p.includes('leetcode') || p.includes('two sum') || p.includes('implement a function') || p.includes('solve this problem') || p.includes('write code to'));

  if (isCodingQuestion) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Analyze the problem constraints, evaluate the brute-force baseline, and apply optimal data structures (Hash Map, Two Pointers, or Binary Search) to achieve linear O(N) or logarithmic O(log N) efficiency.',
      spokenScript: 'To solve this, I first look at the constraints and edge cases. A naive brute-force approach would check every single combination, giving us quadratic O(N²) time. Instead, we can optimize this to linear O(N) time in a single pass using a Hash Map to store elements we have already visited. We trade a small amount of memory for significant CPU performance gains.',
      bullets: [
        'Problem Decomposition: Identify inputs, expected outputs, constraints (e.g. array length, integer ranges, negative numbers, duplicates).',
        'Brute Force Evaluation: Explain why naive nested loops result in unacceptable quadratic O(N²) time complexity for large datasets.',
        'Optimal Strategy: Utilize an in-memory Hash Table or Two-Pointer approach to eliminate redundant scanning, reducing time complexity to linear O(N).',
        'Boundary Conditions: Validate edge cases including empty inputs, single-element collections, extreme integer values, and duplicate targets.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `// Optimal linear time O(N) approach
function solveProblem(items: number[], target: number): [number, number] | null {
  const map = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const complement = target - items[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(items[i], i);
  }
  return null;
}`
      },
      complexity: {
        time: 'O(N) single-pass traversal',
        space: 'O(N) auxiliary space'
      },
      tradeoffs: [
        'Time vs Space: Sacrifice O(N) memory to achieve optimal linear O(N) execution speed.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 21. DYNAMIC SMART TOPIC GENERATOR (NO GENERIC THREE DIMENSIONS FLUFF!)
  // -------------------------------------------------------------
  // Clean topic by stripping greetings, filler phrases, and question marks
  let cleanTopic = prompt
    .replace(/\b(hi|hello|hey|good morning|good afternoon|good evening|punit|puneet|interviewer|candidate)\b/gi, '')
    .replace(/\b(what is|what are|explain|can you tell me about|tell me about|how does|how do|describe|define)\b/gi, '')
    .replace(/[?!.,]/g, '')
    .trim();

  if (!cleanTopic || cleanTopic.length < 2) {
    cleanTopic = prompt.trim();
  }

  // Capitalize first letter of topic
  const formattedTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);

  return {
    id,
    question: prompt,
    mode: 'general',
    summary: `${formattedTopic} is a core software engineering concept used to build scalable, reliable production systems.`,
    spokenScript: `To answer directly: ${formattedTopic} is a foundational technology concept. In practical production architecture, it is utilized to solve key reliability, performance, and maintainability requirements. When explaining this to an interviewer, I highlight its core runtime mechanism under the hood, how we safely implement and monitor it in production, and the key architectural trade-offs compared to alternative approaches.`,
    bullets: [
      `Core Definition: ${formattedTopic} defines how components interact and execute reliably at runtime.`,
      `Production Architecture: Best practices require boundary validation, comprehensive test coverage, and active observability.`,
      `Engineering Trade-Off: Balances raw operational performance against architectural simplicity and maintainability.`
    ],
    tradeoffs: [
      `Carefully evaluate whether ${formattedTopic} adds unnecessary operational complexity compared to simpler patterns for your current scale.`
    ],
    timestamp: now
  };
}

export function evaluateMockAnswer(
  question: string,
  userAnswer: string,
  turnIndex: number
): MockTurnFeedback {
  const words = userAnswer.trim().split(/\s+/).length;
  
  let correctness = 7;
  let clarity = 8;
  let completeness = 6;
  let communication = 7;

  const lowerAns = userAnswer.toLowerCase();
  
  if (words > 60) completeness += 2;
  if (words < 20) {
    completeness -= 3;
    clarity -= 1;
  }

  if (lowerAns.includes('because') || lowerAns.includes('trade-off') || lowerAns.includes('complexity') || lowerAns.includes('for example')) {
    clarity += 1;
    communication += 1;
  }

  if (lowerAns.includes('o(n)') || lowerAns.includes('index') || lowerAns.includes('cache') || lowerAns.includes('async') || lowerAns.includes('star') || lowerAns.includes('gin') || lowerAns.includes('overload')) {
    correctness = Math.min(10, correctness + 2);
  }

  correctness = Math.max(3, Math.min(10, correctness));
  clarity = Math.max(3, Math.min(10, clarity));
  completeness = Math.max(3, Math.min(10, completeness));
  communication = Math.max(3, Math.min(10, communication));

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (words >= 30) {
    strengths.push('Good explanation depth and detailed reasoning.');
  } else {
    improvements.push('Expand your explanation with more concrete engineering details.');
  }

  if (lowerAns.includes('trade-off') || lowerAns.includes('however') || lowerAns.includes('alternative')) {
    strengths.push('Acknowledged trade-offs and alternative solutions.');
  } else {
    improvements.push('Mention architectural trade-offs (e.g. latency vs consistency, memory vs CPU).');
  }

  strengths.push('Professional technical vocabulary and clear pacing.');

  let suggestedFollowUp = 'Can you walk me through how this design would scale if our traffic increased by 10x?';
  if (lowerAns.includes('cache') || lowerAns.includes('redis')) {
    suggestedFollowUp = 'How would you prevent cache stampedes and ensure cache invalidation consistency?';
  } else if (lowerAns.includes('database') || lowerAns.includes('sql') || lowerAns.includes('index')) {
    suggestedFollowUp = 'What indexing strategy would you use on that table to optimize query execution plans?';
  }

  return {
    turnIndex,
    question,
    userAnswer,
    scores: { correctness, clarity, completeness, communication },
    feedback: `Strong response. You demonstrated a solid grasp of foundational principles with good logical pacing. To make this an elite Staff-level answer, weave in specific production metrics and architectural trade-offs.`,
    strengths,
    improvements,
    suggestedFollowUp
  };
}

export function generateFinalMockReport(
  role: string,
  difficulty: string,
  turns: MockTurnFeedback[]
): MockInterviewReport {
  let totalCorrectness = 0;
  let totalClarity = 0;
  let totalCompleteness = 0;
  let totalCommunication = 0;

  turns.forEach(t => {
    totalCorrectness += t.scores.correctness;
    totalClarity += t.scores.clarity;
    totalCompleteness += t.scores.completeness;
    totalCommunication += t.scores.communication;
  });

  const count = turns.length || 1;
  const avgCorrectness = Math.round((totalCorrectness / count) * 10) / 10;
  const avgClarity = Math.round((totalClarity / count) * 10) / 10;
  const avgCompleteness = Math.round((totalCompleteness / count) * 10) / 10;
  const avgCommunication = Math.round((totalCommunication / count) * 10) / 10;

  const overallScore = Math.round(((avgCorrectness + avgClarity + avgCompleteness + avgCommunication) / 4) * 10);

  return {
    id: 'rep_' + Math.random().toString(36).substring(2, 9),
    role,
    difficulty,
    overallScore,
    categoryScores: {
      correctness: avgCorrectness,
      clarity: avgClarity,
      completeness: avgCompleteness,
      communication: avgCommunication
    },
    summary: `The candidate showed strong competency for a ${difficulty} ${role} role, demonstrating solid architectural thinking, structured problem-solving, and clear technical communication.`,
    keyStrengths: [
      'Logical breakdown of complex problems into manageable sub-components.',
      'Clear, articulate speech structure without excessive hesitation.',
      'Good familiarity with modern cloud and data architectures.'
    ],
    priorityFixes: [
      'Proactively state time and space complexities upfront before writing code.',
      'Quantify past project achievements with concrete business metrics (e.g. latency, revenue, uptime).'
    ],
    turns,
    createdAt: Date.now()
  };
}

export function analyzeResumeHeuristics(resumeText: string, jobDescription: string): ResumeAnalysisResult {
  const commonTechSkills = [
    'typescript', 'javascript', 'react', 'next.js', 'node.js', 'python', 'java', 'go',
    'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'postgresql', 'mysql', 'mongodb',
    'redis', 'kafka', 'graphql', 'rest api', 'ci/cd', 'microservices', 'git', 'terraform',
    'system design', 'distributed systems', 'agile', 'unit testing'
  ];

  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  commonTechSkills.forEach(skill => {
    const inJd = jdLower.includes(skill);
    const inResume = resumeLower.includes(skill);

    if (inJd && inResume) {
      matchedSkills.push(skill);
    } else if (inJd && !inResume) {
      missingSkills.push(skill);
    } else if (inResume && matchedSkills.length < 12) {
      matchedSkills.push(skill);
    }
  });

  const totalRelevant = matchedSkills.length + missingSkills.length;
  let matchRatio = totalRelevant > 0 ? (matchedSkills.length / totalRelevant) : 0.65;
  
  if (resumeText.length > 500) matchRatio += 0.05;
  const overallScore = Math.min(94, Math.max(45, Math.round(matchRatio * 100)));

  const bulletImprovements = [
    {
      original: 'Worked on backend APIs and helped improve database queries.',
      improved: 'Architected 12 high-throughput RESTful microservices in Node.js/PostgreSQL, reducing p99 database query latency by 42% via composite indexing and Redis caching.',
      explanation: 'Replaced passive verb "worked on" with strong action verb "Architected" and added quantifiable latency metrics.',
      metricsAdded: '12 microservices, 42% p99 latency reduction'
    },
    {
      original: 'Responsible for CI/CD deployment pipelines and cloud infrastructure.',
      improved: 'Orchestrated automated GitHub Actions CI/CD pipelines deploying containerized workloads to AWS EKS, slashing deployment cycle times from 45 minutes to 4 minutes.',
      explanation: 'Framed responsibility as active ownership with concrete tooling (GitHub Actions, AWS EKS) and measurable efficiency gains.',
      metricsAdded: 'Cut deployment time by 91% (45m -> 4m)'
    },
    {
      original: 'Built user interface components for customer dashboard using React.',
      improved: 'Engineered a modern, responsive analytics dashboard in Next.js/React featuring dynamic virtualization, elevating Lighthouse accessibility to 98% and supporting 15,000 DAU.',
      explanation: 'Highlighted technical complexity (virtualization) and user impact metrics (DAU, Lighthouse score).',
      metricsAdded: '98% Lighthouse accessibility, 15,000 DAU'
    }
  ];

  return {
    overallScore,
    verdict: overallScore >= 80 ? 'Strong Match' : overallScore >= 65 ? 'Competitive Match' : 'Needs Optimization',
    matchedSkills: matchedSkills.slice(0, 10),
    missingSkills: missingSkills.slice(0, 8),
    keywordsDetected: matchedSkills.map(s => s.toUpperCase()),
    missingKeywords: missingSkills.map(s => s.toUpperCase()),
    strengths: [
      'Strong representation of foundational software engineering methodologies.',
      'Clear project timelines and relevant framework exposure.',
      'Modern tech stack alignment.'
    ],
    weaknesses: [
      missingSkills.length > 0 
        ? `Missing key job description competencies: ${missingSkills.slice(0, 4).join(', ')}.`
        : 'Could benefit from more quantified dollar or latency impact metrics.',
      'Several bullet points utilize passive phrasing rather than metric-driven STAR framing.'
    ],
    bulletImprovements,
    disclaimer: 'Transparent heuristic match score based on keyword density and competency overlap, not an official ATS vendor proprietary score.'
  };
}
