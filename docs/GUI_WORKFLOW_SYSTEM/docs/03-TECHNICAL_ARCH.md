# Technical Architecture - GUI Workflow System

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
├───────────────┬──────────────┬──────────────┬──────────────┤
│  Components   │    Stores    │    Hooks     │   Services   │
│               │              │              │              │
│ WorkflowHelper│ workflowStore│ useWorkflow  │ socketService│
│ CommandCard   │ userStore    │ useCommands  │ apiService   │
│ ProgressBar   │ cacheStore   │ useWebSocket │ storageService│
└───────────────┴──────────────┴──────────────┴──────────────┘
                               │
                    WebSocket Connection
                               │
┌─────────────────────────────────────────────────────────────┐
│                        Backend (Node.js)                     │
├──────────────┬───────────────┬───────────────┬─────────────┤
│  WebSocket   │   Services    │  Middleware   │   Models    │
│              │               │               │             │
│ Socket.io    │WorkflowEngine │ authMiddleware│ Workflow    │
│ Rooms        │CommandMatcher │ validation    │ WorkflowStep│
│ Events       │StateManager   │ rateLimit     │ UserProgress│
└──────────────┴───────────────┴───────────────┴─────────────┘
                               │
                     ┌─────────┴──────────┐
                     │                    │
              ┌──────▼──────┐     ┌──────▼──────┐
              │    Redis    │     │   MongoDB   │
              │   (Cache)   │     │ (Persistence)│
              └─────────────┘     └─────────────┘
```

## Technology Stack Details

### Frontend Technologies

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| React | 18.2 | UI Framework | Existing stack |
| Zustand | 4.4.7 | State Management | Lightweight (8kb), simple API |
| Socket.io-client | 4.6.0 | WebSocket Client | Auto-reconnection, rooms |
| Framer Motion | 11.0.0 | Animations | Best React animation library |
| TailwindCSS | 3.3.0 | Styling | Utility-first, fast development |
| TypeScript | 5.3.0 | Type Safety | Catch errors early |

### Backend Technologies

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| Node.js | 20.x | Runtime | Existing stack |
| Express | 4.18 | Web Server | Existing stack |
| Socket.io | 4.6.0 | WebSocket Server | Real-time, reliable |
| Redis | 4.6.0 | Caching | Fast, TTL support |
| MongoDB | 6.0 | Database | Existing stack |
| TypeScript | 5.3.0 | Type Safety | Maintainability |

## Data Flow Architecture

### 1. Workflow Initiation Flow
```
User Input → Chat Component → AI Agent → Intent Detection
    ↓                                           ↓
Send Message                          Detect Workflow Need
    ↓                                           ↓
WebSocket ←─────────────────────────── Emit workflow:start
    ↓
Update Zustand Store → Render WorkflowHelper
```

### 2. Command Execution Flow
```
User Clicks "Use" → Insert to Chat Input → Send Command
         ↓                                        ↓
Update Local State                    Backend Validation
         ↓                                        ↓
Optimistic Update ←───────────────── WebSocket Response
         ↓
Auto-advance Step
```

### 3. State Synchronization Flow
```
Frontend State (Zustand) ←→ WebSocket ←→ Backend State (Redis)
         ↓                                        ↓
    LocalStorage                            MongoDB
   (Persistence)                        (Long-term Storage)
```

## Core Components Deep Dive

### Frontend: Zustand Store Architecture

```typescript
// stores/workflowStore.ts
interface WorkflowState {
  // State
  activeWorkflow: Workflow | null;
  currentStep: number;
  completedSteps: number[];
  stepData: Record<string, any>;
  isHelperVisible: boolean;
  
  // Actions
  startWorkflow: (workflowId: string) => void;
  advanceStep: () => void;
  jumpToStep: (step: number) => void;
  updateStepData: (step: number, data: any) => void;
  completeWorkflow: () => void;
  
  // Computed
  progress: number;
  canAdvance: boolean;
  canGoBack: boolean;
}

const useWorkflowStore = create<WorkflowState>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Implementation
      })),
      {
        name: 'workflow-storage',
        partialize: (state) => ({
          activeWorkflow: state.activeWorkflow,
          currentStep: state.currentStep,
          stepData: state.stepData
        })
      }
    )
  )
);
```

### Backend: WorkflowEngine Architecture

```typescript
// services/WorkflowEngine.ts
class WorkflowEngine {
  private io: Server;
  private redis: Redis;
  private workflows: Map<string, WorkflowDefinition>;
  private sessions: Map<string, SessionState>;
  
  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: process.env.FRONTEND_URL },
      transports: ['websocket']
    });
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    });
    
    this.setupEventHandlers();
    this.loadWorkflows();
  }
  
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
      
      socket.on('workflow:start', this.handleWorkflowStart.bind(this));
      socket.on('workflow:advance', this.handleWorkflowAdvance.bind(this));
      socket.on('command:execute', this.handleCommandExecute.bind(this));
      socket.on('disconnect', this.handleDisconnect.bind(this));
    });
  }
  
  private async handleWorkflowStart(
    socket: Socket, 
    data: { workflowId: string }
  ): Promise<void> {
    const workflow = this.workflows.get(data.workflowId);
    if (!workflow) {
      socket.emit('error', { message: 'Workflow not found' });
      return;
    }
    
    const session = {
      userId: socket.data.userId,
      workflowId: data.workflowId,
      currentStep: 0,
      startedAt: Date.now(),
      data: {}
    };
    
    // Store in Redis with TTL
    await this.redis.setex(
      `session:${socket.id}`,
      3600,
      JSON.stringify(session)
    );
    
    // Join workflow room
    socket.join(`workflow:${data.workflowId}`);
    
    // Emit to all clients
    this.io.to(socket.data.userId).emit('workflow:started', {
      workflow,
      session
    });
  }
}
```

### WebSocket Event Protocol

```typescript
// Shared types between frontend and backend
interface WorkflowEvents {
  // Client → Server
  'workflow:start': { workflowId: string };
  'workflow:advance': { step: number };
  'workflow:jump': { step: number };
  'workflow:complete': { data: any };
  'command:execute': { command: string; stepId: string };
  
  // Server → Client
  'workflow:started': { workflow: Workflow; session: Session };
  'workflow:advanced': { step: number; validated: boolean };
  'workflow:completed': { summary: any };
  'command:result': { success: boolean; data: any };
  'workflow:error': { message: string; code: string };
}
```

## Database Schema

### MongoDB Collections

```javascript
// workflows collection
{
  _id: ObjectId,
  workflowId: String,
  name: String,
  category: String,
  steps: [{
    id: String,
    name: String,
    commands: [{
      template: String,
      example: String,
      required: Boolean,
      validation: String
    }],
    hooks: [{
      type: String,
      action: String,
      params: Object
    }]
  }],
  metadata: {
    avgDuration: Number,
    successRate: Number,
    usageCount: Number
  }
}

// workflowHistory collection
{
  _id: ObjectId,
  userId: String,
  workflowId: String,
  startedAt: Date,
  completedAt: Date,
  steps: [{
    stepId: String,
    startedAt: Date,
    completedAt: Date,
    commands: [String],
    data: Object
  }],
  outcome: String,
  duration: Number
}

// userProgress collection  
{
  _id: ObjectId,
  userId: String,
  statistics: {
    workflowsCompleted: Number,
    commandsLearned: [String],
    efficiencyScore: Number,
    favoriteWorkflows: [String]
  },
  achievements: [{
    id: String,
    unlockedAt: Date
  }]
}
```

### Redis Data Structure

```javascript
// Session State (TTL: 1 hour)
KEY: session:{sessionId}
VALUE: {
  userId: string,
  workflowId: string,
  currentStep: number,
  completedSteps: number[],
  stepData: object,
  startedAt: timestamp
}

// Command Cache (TTL: 5 minutes)
KEY: command:{userId}:{command}
VALUE: {
  lastUsed: timestamp,
  frequency: number,
  success: boolean
}

// Workflow Lock (TTL: 30 seconds)
KEY: lock:workflow:{userId}
VALUE: workflowId
```

## Security Architecture

### Authentication Flow
```
1. User logs in via main app
2. Session token stored in httpOnly cookie
3. WebSocket handshake includes session
4. Backend validates session
5. Socket authenticated for duration
```

### Authorization Levels
- **Read**: View workflows, see commands
- **Execute**: Run commands, complete workflows
- **Create**: Build custom workflows
- **Admin**: Manage all workflows, view analytics

### Data Validation
```typescript
// Command validation pipeline
class CommandValidator {
  validate(command: string, template: string): ValidationResult {
    // 1. Syntax validation
    if (!this.matchesTemplate(command, template)) {
      return { valid: false, error: 'Invalid syntax' };
    }
    
    // 2. Data type validation
    const params = this.extractParams(command, template);
    if (!this.validateTypes(params)) {
      return { valid: false, error: 'Invalid data type' };
    }
    
    // 3. Business logic validation
    if (!this.validateBusinessRules(params)) {
      return { valid: false, error: 'Business rule violation' };
    }
    
    // 4. Security validation
    if (!this.validateSecurity(params)) {
      return { valid: false, error: 'Security check failed' };
    }
    
    return { valid: true, params };
  }
}
```

## Performance Optimization

### Frontend Optimizations
```typescript
// 1. Lazy load workflows
const WorkflowHelper = lazy(() => import('./WorkflowHelper'));

// 2. Memoize expensive computations
const commands = useMemo(() => 
  generateCommands(workflow, currentStep),
  [workflow, currentStep]
);

// 3. Virtualize long lists
<VirtualList
  items={workflows}
  height={600}
  itemHeight={50}
  renderItem={renderWorkflowItem}
/>

// 4. Debounce WebSocket emissions
const debouncedEmit = useMemo(
  () => debounce(socketService.emit, 300),
  []
);
```

### Backend Optimizations
```typescript
// 1. Connection pooling
const redisPool = createPool({
  min: 2,
  max: 10
});

// 2. Caching strategy
class CacheManager {
  async get(key: string): Promise<any> {
    // L1: Memory cache (10ms)
    if (this.memory.has(key)) {
      return this.memory.get(key);
    }
    
    // L2: Redis cache (50ms)
    const cached = await this.redis.get(key);
    if (cached) {
      this.memory.set(key, cached);
      return cached;
    }
    
    // L3: Database (200ms)
    const data = await this.db.find(key);
    await this.redis.setex(key, 300, data);
    this.memory.set(key, data);
    return data;
  }
}

// 3. Batch operations
class BatchProcessor {
  private queue: Command[] = [];
  
  add(command: Command): void {
    this.queue.push(command);
    if (this.queue.length >= 10) {
      this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    const batch = this.queue.splice(0, 10);
    await this.processBatch(batch);
  }
}
```

## Scalability Strategy

### Horizontal Scaling
```yaml
# docker-compose.yml
services:
  app:
    image: intellicare/workflow-system
    deploy:
      replicas: 3
    environment:
      - REDIS_HOST=redis
      - MONGO_HOST=mongo
  
  nginx:
    image: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
  
  redis:
    image: redis:alpine
    deploy:
      replicas: 1
  
  mongo:
    image: mongo
    deploy:
      replicas: 3
      replica_set: rs0
```

### Load Balancing
```nginx
# nginx.conf
upstream websocket {
  ip_hash;  # Sticky sessions for WebSocket
  server app1:3000;
  server app2:3000;
  server app3:3000;
}

server {
  listen 80;
  
  location /socket.io/ {
    proxy_pass http://websocket;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## Monitoring & Analytics

### Metrics Collection
```typescript
// Prometheus metrics
class MetricsCollector {
  private workflowStarted = new Counter({
    name: 'workflow_started_total',
    help: 'Total workflows started',
    labelNames: ['workflow_id']
  });
  
  private workflowDuration = new Histogram({
    name: 'workflow_duration_seconds',
    help: 'Workflow completion time',
    labelNames: ['workflow_id'],
    buckets: [30, 60, 120, 300, 600]
  });
  
  private commandExecuted = new Counter({
    name: 'command_executed_total',
    help: 'Total commands executed',
    labelNames: ['command', 'success']
  });
}
```

### Error Tracking
```typescript
// Sentry integration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Sanitize sensitive data
    delete event.request?.cookies;
    delete event.user?.email;
    return event;
  }
});
```

---

**Continue to:** [Implementation Guide](04-IMPLEMENTATION.md)