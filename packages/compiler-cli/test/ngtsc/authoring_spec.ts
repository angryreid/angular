/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {runInEachFileSystem} from '../../src/ngtsc/file_system/testing';
import {loadStandardTestFiles} from '../../src/ngtsc/testing';

import {NgtscTestEnvironment} from './env';

const testFiles = loadStandardTestFiles();

runInEachFileSystem(() => {
  describe('input()', () => {
    let env!: NgtscTestEnvironment;

    beforeEach(() => {
      env = NgtscTestEnvironment.setup(testFiles);
      env.tsconfig({strictTemplates: true});
    });

    it('should handle a basic, primitive valued input', () => {
      env.write('test.ts', `
        import {Directive, input} from '@angular/core';

        @Directive()
        export class TestDir {
          data = input('test');
        }
      `);
      env.driveMain();
      const js = env.getContents('test.js');
      expect(js).toContain('inputs: { data: [i0.ɵɵInputFlags.SignalBased, "data"] }');
    });

    it('should handle an alias configured, primitive valued input', () => {
      env.write('test.ts', `
        import {Directive, input} from '@angular/core';

        @Directive()
        export class TestDir {
          data = input('test', {
            alias: 'publicName',
          });
        }
      `);
      env.driveMain();
      const js = env.getContents('test.js');
      expect(js).toContain('inputs: { data: [i0.ɵɵInputFlags.SignalBased, "publicName", "data"] }');
    });

    it('should error if a required input declares an initial value', () => {
      env.write('test.ts', `
        import {Directive, input} from '@angular/core';

        @Directive()
        export class TestDir {
          data = input.required({
            initialValue: 'bla',
          });
        }
      `);
      const diagnostics = env.driveDiagnostics();
      expect(diagnostics[0].messageText).toEqual(jasmine.objectContaining({
        messageText: 'No overload matches this call.',
      }));
    });


    it('should handle a transform and required input', () => {
      env.write('test.ts', `
        import {Directive, input} from '@angular/core';

        @Directive()
        export class TestDir {
          data = input.required({
            transform: (v: string|number) => 'works',
          });
        }
      `);
      env.driveMain();
      expect(env.getContents('test.js'))
          .toContain(`inputs: { data: [i0.ɵɵInputFlags.SignalBased, "data"] }`);
      expect(env.getContents('test.d.ts')).toContain('"required": true; "isSignal": true;');
      expect(env.getContents('test.d.ts'))
          .withContext(
              'Expected no coercion member as input signal captures the write type of the transform')
          .not.toContain('ngAcceptInputType');
    });


    it('should handle a non-primitive initial value', () => {
      env.write('test.ts', `
        import {Directive, input} from '@angular/core';

        @Directive()
        export class TestDir {
          data = input(/default pattern/);
        }
      `);
      env.driveMain();
      expect(env.getContents('test.js'))
          .toContain(`inputs: { data: [i0.ɵɵInputFlags.SignalBased, "data"] }`);
    });

    describe('type checking', () => {
      it('should work', () => {
        env.write('test.ts', `
          import {Component, Directive, input} from '@angular/core';

          @Directive({
            selector: '[directiveName]',
            standalone: true,
          })
          export class TestDir {
            data = input(1);
          }

          @Component({
            standalone: true,
            template: \`<div directiveName [data]="false"></div>\`,
            imports: [TestDir],
          })
          export class TestComp {
          }
        `);

        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText)
            .toBe(`Type 'boolean' is not assignable to type 'number'.`);
      });

      it('should work with transforms', () => {
        env.write('test.ts', `
          import {Component, Directive, input} from '@angular/core';

          @Directive({
            selector: '[directiveName]',
            standalone: true,
          })
          export class TestDir {
            data = input.required({
              transform: (v: string|number) => 'works',
            });
          }

          @Component({
            standalone: true,
            template: \`<div directiveName [data]="false"></div>\`,
            imports: [TestDir],
          })
          export class TestComp {
          }
        `);

        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText)
            .toBe(`Type 'boolean' is not assignable to type 'string | number'.`);
      });

      it('should report unset required inputs', () => {
        env.write('test.ts', `
          import {Component, Directive, input} from '@angular/core';

          @Directive({
            selector: '[directiveName]',
            standalone: true,
          })
          export class TestDir {
            data = input.required<boolean>();
          }

          @Component({
            standalone: true,
            template: \`<div directiveName></div>\`,
            imports: [TestDir],
          })
          export class TestComp {
          }
        `);

        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText)
            .toBe(`Required input 'data' from directive TestDir must be specified.`);
      });
    });
  });
});
