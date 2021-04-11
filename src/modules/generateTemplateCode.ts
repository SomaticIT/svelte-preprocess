import { parse, walk } from 'svelte/compiler';
import type { TemplateNode } from 'svelte/types/compiler/interfaces';

const stripTags = (source: string) =>
  source
    .replace(/<!--[^]*?-->|<style(\s[^]*?)?(?:>([^]*?)<\/style>|\/>)/gi, '')
    .replace(/<!--[^]*?-->|<script(\s[^]*?)?(?:>([^]*?)<\/script>|\/>)/gi, '');

type AstGenerator = {
  tab(): string;
  expression(node: TemplateNode | null | undefined): string;
  append(str: string): void;
  appendVariable(initializer: string): void;
  startBlock(expression: string, node?: TemplateNode): void;
  startFunc(args: string[], node?: TemplateNode): void;
  endBlock(node?: TemplateNode): void;
  toString(): string;
};

const createAstGenerator = (markup: string): AstGenerator => {
  const result: string[] = [];
  const opened = new Set<TemplateNode>();
  let level = 0;
  let i = 0;

  const tab = () => ''.padEnd(level * 4, ' ');

  const expression = (node: TemplateNode | null | undefined) =>
    node ? markup.slice(node.start, node.end) : '';

  const append = (str: string) => {
    if (str) {
      result.push(`${tab()}${str}`);
    }
  };

  const appendVariable = (initializer?: string) => {
    if (initializer) {
      append(`let var$$${i++} = ${initializer};`);
    }
  };

  const startBlock = (expr: string, node?: any) => {
    if (node) opened.add(node);
    append(`${expr} {`);
    level++;
  };

  const endBlock = (node?: any) => {
    if (level === 0) return;
    if (node && !opened.has(node)) return;
    level--;
    append(`}`);
  };

  const startFunc = (args: string[], node?: any) => {
    startBlock(`function fn$$${i++}(${args.join(', ')})`, node);
  };

  const toString = () => result.join('\n');

  return {
    tab,
    expression,
    append,
    appendVariable,
    startBlock,
    endBlock,
    startFunc,
    toString,
  };
};

type NodeGenerator = (
  generator: AstGenerator,
  node: TemplateNode,
  parent?: TemplateNode,
) => void | undefined | boolean;

const getNodeGenerators = (markup: string): Record<string, NodeGenerator> => ({
  InlineComponent(g, node) {
    const name =
      node.name === 'svelte:component'
        ? g.expression(node.expression)
        : node.name;

    g.append(`new ${name}();`);

    const lets = node.attributes?.filter((a) => a.type === 'Let') ?? [];

    if (lets.length > 0) {
      const args = lets.map((a) => g.expression(a.expression) || a.name);

      g.startFunc(args, node);
    }
  },
  IfBlock(g, node, parent) {
    const isElseIf = parent.type === 'ElseBlock';
    const keyword = isElseIf ? 'else if' : 'if';

    if (isElseIf) g.endBlock();
    g.startBlock(`${keyword} (${g.expression(node.expression)})`, node);
  },
  ElseBlock(g, node, parent) {
    if (node.children?.[0]?.type === 'IfBlock') return;
    g.endBlock();
    if (parent.type === 'EachBlock') g.endBlock();
    g.startBlock(`else`, node);
  },
  EachBlock(g, node) {
    const arr = g.expression(node.expression);
    const context = g.expression(node.context);

    if (node.else) {
      g.startBlock(`if (${arr})`, node);
    }

    g.startBlock(`for (const ${context} of ${arr})`, node);
  },
  AwaitBlock(g, node) {
    g.startBlock(`try`);

    if (node.pending) {
      g.append(generateNode(markup, node.pending));
    }

    const value = g.expression(node.value);
    const expr = g.expression(node.expression);

    g.append(value ? `const ${value} = await ${expr};` : `await ${expr};`);

    if (node.then) {
      g.append(generateNode(markup, node.then));
    }

    g.endBlock();

    if (node.catch) {
      const error = g.expression(node.error);

      g.startBlock(error ? `catch (${error})` : 'catch');
      g.append(generateNode(markup, node.catch));
      g.endBlock();
    } else {
      g.append('catch {}');
    }

    return false;
  },
  KeyBlock(g, node) {
    g.startBlock(`/*key*/ if (${g.expression(node.expression)})`, node);
  },
  MustacheTag(g, node) {
    g.appendVariable(`${g.expression(node.expression)}`);
  },
  RawMustacheTag(g, node) {
    g.appendVariable(`${g.expression(node.expression)}`);
  },
  DebugTag(g, node) {
    for (const identifier of node.identifiers) {
      g.appendVariable(`${identifier.name}`);
    }
  },
  AttributeShorthand(g, node) {
    g.appendVariable(`${g.expression(node.expression)}`);
  },
  Binding(g, node) {
    g.appendVariable(`${g.expression(node.expression)}`);
  },
  Class(g, node) {
    g.appendVariable(
      `${g.expression(node.expression)} ? '${node.name}' : null`,
    );
  },
  EventHandler(g, node) {
    g.appendVariable(`${g.expression(node.expression)}`);
  },
  Action(g, node) {
    if (node.expression) {
      const arg = g.expression(node.expression);

      g.append(`${node.name}(document.body, ${arg});`);
    } else {
      g.append(`${node.name}(document.body);`);
    }
  },
  Transition(g, node) {
    const arg = g.expression(node.expression);

    g.append(`${node.name}(document.body, ${arg});`);
  },
  Animation(g, node) {
    const rect = `{ x: 0, y: 0, width: 0, height: 0 }`;
    const animation = `{ from: ${rect}, to: ${rect} }`;
    const arg = g.expression(node.expression);

    g.append(`${node.name}(document.body, ${animation}, ${arg});`);
  },
  Spread(g, node) {
    g.appendVariable(`{ ...${g.expression(node.expression)} }`);
  },
  Element(g, node) {
    const attrs = node.attributes ?? [];

    if (attrs.some((a) => a.name === 'slot')) {
      const lets = attrs.filter((a) => a.type === 'Let');

      if (lets.length > 0) {
        const args = lets.map((a) => g.expression(a.expression) || a.name);

        g.startFunc(args, node);
      }
    }
  },
  SlotTemplate(g, node) {
    const lets = node.attributes?.filter((a) => a.type === 'Let') ?? [];

    if (lets.length > 0) {
      const args = lets.map((a) => g.expression(a.expression) || a.name);

      g.startFunc(args, node);
    }
  },

  // TODO: ensure <slot>
  // TODO: refactor
});

function generateNode(markup: string, root: TemplateNode): string {
  const g = createAstGenerator(markup);
  const nodeGenerators = getNodeGenerators(markup);

  walk(root as any, {
    // eslint-disable-next-line max-params
    enter(this, node, parent, key) {
      if (key === 'expression' || key === 'context') {
        return this.skip();
      }

      const nodeGenerator = nodeGenerators[node.type];
      const returnValue = nodeGenerator?.(
        g,
        node as TemplateNode,
        parent as TemplateNode,
      );

      if (returnValue === false) {
        return this.skip();
      }
    },
    // eslint-disable-next-line max-params
    leave(this, node) {
      g.endBlock(node as TemplateNode);
    },
  });

  return g.toString();
}

export type AstOptions = {
  markup: string;
  filename?: string;
};

export function generateTemplateCode({ markup, filename }: AstOptions): string {
  const template = stripTags(markup);
  const ast = parse(template, { filename });

  return generateNode(template, ast.html);
}

export function printAst({ markup, filename }: AstOptions): string {
  const template = stripTags(markup);
  const ast = parse(template, { filename });

  const tree: string[] = [];
  let level = 0;

  walk(ast.html as any, {
    // eslint-disable-next-line max-params
    enter(this, node, p, key) {
      if (key === 'expression' || key === 'context') {
        return this.skip();
      }

      tree.push(`${''.padStart(level++ * 4, ' ')} BEGIN ${node.type} (${key})`);
    },
    // eslint-disable-next-line max-params
    leave(this, node, p, key) {
      tree.push(`${''.padStart(--level * 4, ' ')} END ${node.type} (${key})`);
    },
  });

  return tree.join('\n');
}
