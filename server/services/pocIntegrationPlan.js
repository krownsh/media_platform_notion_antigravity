const MAX_STEPS = 20;
const MAX_ASSERTIONS = 40;
const MAX_STDIN_LENGTH = 32_000;
const ALLOWED_PHASES = new Set(['setup', 'interaction', 'observation']);
const ALLOWED_OPERATORS = new Set(['equals', 'contains', 'matches']);
const ALLOWED_FIELDS = new Set(['exit_code', 'stdout', 'stderr']);
const ALLOWED_COMMANDS = new Set([
  'git', 'npm', 'npx', 'node', 'python', 'python3', 'pip', 'pip3', 'curl', 'jq'
]);
const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;

export class PocTestPlanError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PocTestPlanError';
    this.code = 'POC_TEST_PLAN_INVALID';
  }
}

function text(value, maxLength, label, required = false) {
  const result = typeof value === 'string' ? value.trim().slice(0, maxLength + 1) : '';
  if (required && !result) throw new PocTestPlanError(`${label} is required`);
  if (result.length > maxLength) throw new PocTestPlanError(`${label} exceeds ${maxLength} characters`);
  return result;
}

function stringList(value, label, { required = false, maxItems = 20, maxLength = 1_000 } = {}) {
  const result = Array.isArray(value)
    ? value.map(item => text(item, maxLength, label)).filter(Boolean).slice(0, maxItems + 1)
    : [];
  if (required && result.length === 0) throw new PocTestPlanError(`${label} is required`);
  if (result.length > maxItems) throw new PocTestPlanError(`${label} exceeds ${maxItems} items`);
  return result;
}

function normalizeCommand(value, stepId) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) {
    throw new PocTestPlanError(`Step ${stepId} argv must contain 1-40 arguments`);
  }
  const argv = value.map((item, index) => text(item, 4_000, `Step ${stepId} argv[${index}]`, true));
  const executable = argv[0];
  const isWorkspaceBinary = /^\/workspace\/[a-zA-Z0-9_./-]+$/.test(executable)
    && !executable.split('/').includes('..');
  if (!ALLOWED_COMMANDS.has(executable) && !isWorkspaceBinary) {
    throw new PocTestPlanError(`Step ${stepId} executable is not allowed: ${executable}`);
  }
  if (argv.some(item => item.includes('\0'))) {
    throw new PocTestPlanError(`Step ${stepId} argv contains a null byte`);
  }
  return argv;
}

export function validateIntegrationTestPlan(rawPlan) {
  if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) {
    throw new PocTestPlanError('POC test_plan must be a JSON object');
  }
  if (rawPlan.kind !== 'integration') {
    throw new PocTestPlanError('POC test_plan.kind must be integration');
  }

  const objective = text(rawPlan.objective, 2_000, 'test_plan.objective', true);
  const claimsUnderTest = stringList(rawPlan.claims_under_test, 'test_plan.claims_under_test', {
    required: true,
    maxItems: 20,
    maxLength: 1_000
  });
  const limitations = stringList(rawPlan.limitations, 'test_plan.limitations', {
    required: true,
    maxItems: 20,
    maxLength: 1_000
  });
  const environment = rawPlan.environment && typeof rawPlan.environment === 'object'
    ? rawPlan.environment
    : {};
  const requiredSecrets = stringList(environment.required_secrets, 'test_plan.environment.required_secrets', {
    maxItems: 10,
    maxLength: 80
  });
  for (const name of requiredSecrets) {
    if (!SECRET_NAME_PATTERN.test(name)) {
      throw new PocTestPlanError(`Invalid required secret name: ${name}`);
    }
  }

  if (!Array.isArray(rawPlan.steps) || rawPlan.steps.length === 0 || rawPlan.steps.length > MAX_STEPS) {
    throw new PocTestPlanError(`test_plan.steps must contain 1-${MAX_STEPS} steps`);
  }
  const ids = new Set();
  const steps = rawPlan.steps.map((rawStep, index) => {
    if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) {
      throw new PocTestPlanError(`Step ${index + 1} must be an object`);
    }
    const id = text(rawStep.id, 80, `Step ${index + 1} id`, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) {
      throw new PocTestPlanError(`Step id must be unique and URL-safe: ${id}`);
    }
    ids.add(id);
    const phase = text(rawStep.phase, 20, `Step ${id} phase`, true);
    if (!ALLOWED_PHASES.has(phase)) throw new PocTestPlanError(`Step ${id} has unsupported phase: ${phase}`);
    const cwd = text(rawStep.cwd || '.', 500, `Step ${id} cwd`, true);
    if (pathEscapesWorkspace(cwd)) throw new PocTestPlanError(`Step ${id} cwd escapes /workspace`);
    return {
      id,
      phase,
      label: text(rawStep.label, 500, `Step ${id} label`, true),
      argv: normalizeCommand(rawStep.argv, id),
      cwd,
      stdin: text(rawStep.stdin, MAX_STDIN_LENGTH, `Step ${id} stdin`),
      timeout_ms: Math.min(Math.max(Number(rawStep.timeout_ms) || 60_000, 1_000), 300_000)
    };
  });
  if (!steps.some(step => step.phase === 'interaction')) {
    throw new PocTestPlanError('Integration POC requires at least one interaction step with a real request/action');
  }
  if (!steps.some(step => step.phase === 'observation')) {
    throw new PocTestPlanError('Integration POC requires at least one observation step for the produced result');
  }

  if (!Array.isArray(rawPlan.assertions) || rawPlan.assertions.length === 0 || rawPlan.assertions.length > MAX_ASSERTIONS) {
    throw new PocTestPlanError(`test_plan.assertions must contain 1-${MAX_ASSERTIONS} assertions`);
  }
  const assertions = rawPlan.assertions.map((rawAssertion, index) => {
    if (!rawAssertion || typeof rawAssertion !== 'object' || Array.isArray(rawAssertion)) {
      throw new PocTestPlanError(`Assertion ${index + 1} must be an object`);
    }
    const stepId = text(rawAssertion.step_id, 80, `Assertion ${index + 1} step_id`, true);
    if (!ids.has(stepId)) throw new PocTestPlanError(`Assertion references unknown step: ${stepId}`);
    const field = text(rawAssertion.field, 20, `Assertion ${index + 1} field`, true);
    const operator = text(rawAssertion.operator, 20, `Assertion ${index + 1} operator`, true);
    if (!ALLOWED_FIELDS.has(field)) throw new PocTestPlanError(`Unsupported assertion field: ${field}`);
    if (!ALLOWED_OPERATORS.has(operator)) throw new PocTestPlanError(`Unsupported assertion operator: ${operator}`);
    const expected = field === 'exit_code' && operator === 'equals'
      ? Number(rawAssertion.expected)
      : text(String(rawAssertion.expected ?? ''), 4_000, `Assertion ${index + 1} expected`);
    if (field === 'exit_code' && operator === 'equals' && !Number.isInteger(expected)) {
      throw new PocTestPlanError('exit_code equals assertions require an integer expected value');
    }
    if (operator === 'matches') {
      try { new RegExp(expected); } catch { throw new PocTestPlanError(`Assertion ${index + 1} has invalid regex`); }
    }
    return {
      id: text(rawAssertion.id || `assertion-${index + 1}`, 80, `Assertion ${index + 1} id`, true),
      description: text(rawAssertion.description, 1_000, `Assertion ${index + 1} description`, true),
      step_id: stepId,
      field,
      operator,
      expected
    };
  });
  const assertedStepIds = new Set(assertions.map(assertion => assertion.step_id));
  const uncoveredStep = steps.find(step => !assertedStepIds.has(step.id));
  if (uncoveredStep) {
    throw new PocTestPlanError(`Every planned step needs evidence criteria; missing assertion for: ${uncoveredStep.id}`);
  }
  const observationIds = new Set(steps.filter(step => step.phase === 'observation').map(step => step.id));
  if (!assertions.some(assertion => observationIds.has(assertion.step_id))) {
    throw new PocTestPlanError('Integration POC requires an assertion against an observed result');
  }

  return {
    schema_version: 1,
    kind: 'integration',
    objective,
    claims_under_test: claimsUnderTest,
    environment: {
      network_access: environment.network_access === true,
      required_secrets: requiredSecrets
    },
    steps,
    assertions,
    limitations
  };
}

function pathEscapesWorkspace(value) {
  if (value.startsWith('/')) return !value.startsWith('/workspace');
  return value.split(/[\\/]/).includes('..');
}

export function evaluateIntegrationAssertions(planInput, stepResults) {
  const plan = validateIntegrationTestPlan(planInput);
  const resultsById = new Map((stepResults || []).map(result => [result.id, result]));
  const assertions = plan.assertions.map(assertion => {
    const step = resultsById.get(assertion.step_id);
    const actual = step?.[assertion.field];
    let passed = false;
    if (step) {
      if (assertion.operator === 'equals') passed = actual === assertion.expected;
      if (assertion.operator === 'contains') passed = String(actual ?? '').includes(String(assertion.expected));
      if (assertion.operator === 'matches') passed = new RegExp(assertion.expected).test(String(actual ?? ''));
    }
    return { ...assertion, actual: actual ?? null, passed };
  });
  return { passed: assertions.every(assertion => assertion.passed), assertions };
}
