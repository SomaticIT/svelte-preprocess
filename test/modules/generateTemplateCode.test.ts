import { getTestAppFilename, getFixtureContent } from '../utils';
import { generateTemplateCode } from '../../src/modules/generateTemplateCode';

describe('generateTemplateCode', () => {
  it('should transform markup ast to plain javascript', async () => {
    const source = getFixtureContent('TypeScriptTransformer.svelte');

    const code = generateTemplateCode({
      source,
      filename: getTestAppFilename(),
    });

    return expect(code).toMatchInlineSnapshot(`
              "let var$$0 = onKeyDown;
              let var$$1 = scrollY;
              let var$$2 = innerWidth;
              let var$$3 = onKeyDown;
              let var$$4 = val;
              new Nested();
              function fn$$5(var1, var3) {
                  new Nested();
                  let var$$6 = nested;
                  new Nested();
                  let var$$7 = { ...obj };
                  new Nested();
                  let var$$8 = { ...{ var1, var3 } };
                  function fn$$9(var5) {
                      new Nested();
                      let var$$10 = { ...{ var5 } };
                  }
                  function fn$$11(var7) {
                      new Nested();
                      let var$$12 = { ...{ var7 } };
                  }
                  new Nested();
                  let var$$13 = { ...{ val } };
              }
              new ui.MyNested();
              let var$$14 = val;
              let var$$15 = onKeyDown;
              let var$$16 = inputVal;
              let var$$17 = !!inputVal ? 'value' : null;
              let var$$18 = hello;
              let var$$19 = inputVal;
              action(document.body, { id: val });
              action2(document.body);
              if (AValue && val) {
                  fly(document.body, { duration });
                  let var$$20 = AValue;
              }
              if (val && isTest1(val) && AValue && true && \\"test\\") {
                  let var$$21 = AValue;
              }
              else if (obj.val && obj.fn() && isTest1(obj.val)) {
                  let var$$22 = AValue;
              }
              else {
              }
              for (const item of arr) {
                  flip(document.body, { from: { x: 0, y: 0, width: 0, height: 0 }, to: { x: 0, y: 0, width: 0, height: 0 } }, { duration });
                  let var$$23 = item;
              }
              if (arr) {
                  for (const item of arr) {
                      let var$$24 = item;
                  }
              }
              else {
              }
              try {
                  const value = await prom;
                  let var$$0 = val;
              let var$$1 = value;
              let var$$2 = e => inputVal = e.currentTarget.value;
              }
              catch (err) {
                  let var$$0 = err;
              }
              try {
                  const value = await prom;
                  let var$$0 = value;
              }
              catch {
              }
              /*key*/ if (val) {
                  let var$$25 = val;
              }
              let var$$26 = inputVal;
              let var$$27 = inputVal;
              let var$$28 = val;
              let var$$29 = val;
              let var$$30 = inputVal;"
            `);
  });
});
