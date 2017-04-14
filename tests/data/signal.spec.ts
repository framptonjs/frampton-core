import * as Signal from '../../src/data/signal';
import { assert } from 'chai';


describe('Signal', function() {
  describe('create', function() {
    it('should create a signal with initial value', function() {
      const actual: number = Signal.create(2).value;
      const expected: number = 2;

      assert.equal(actual, expected);
    });
  });

  describe('toString', function() {
    it('should create correct string representation', function() {
      const actual: string = Signal.create(2).toString();
      const expected: string = 'Signal(2)';

      assert.equal(actual, expected);
    });
  });

  describe('onValue', function() {
    it('should call given function with initial signal value', function() {
      const sig = Signal.create(3);
      sig.onValue((val: number) => {
        assert.equal(val, 3);
      });
    });

    it('should call given function with signal value on update', function() {
      var count = 0;
      const sig = Signal.create(3);
      sig.onValue((val: number) => {
        if (count === 0) {
          assert.equal(val, 3);
        } else {
          assert.equal(count, 1);
          assert.equal(val, 1);
        }

        count += 1;
      });

      Signal.push(sig, 1);
    });
  });

  describe('onChange', function() {
    it('should call given function with initial signal value', function() {
      const sig = Signal.create(3);

      sig.onChange((val: number) => {
        assert.equal(val, 3);
      });
    });

    it('should not call given function with signal value when value repeats', function() {
      var count = 0;
      const sig = Signal.create(3);

      sig.onChange((val: number) => {
        assert.equal(count, 0);
        assert.equal(val, 3);
        count += 1;
      });

      Signal.push(sig, 3);
    });

    it('should call given function with signal value when value changes', function() {
      var count = 0;
      const sig = Signal.create(3);

      sig.onChange((val: number) => {
        if (count === 0) {
          assert.equal(val, 3);
        } else {
          assert.equal(count, 1);
          assert.equal(val, 1);
        }

        count += 1;
      });

      Signal.push(sig, 1);
    });
  });

  describe('onNext', function() {
    it('should not call given function with initial signal value', function() {
      const sig = Signal.create(3);

      sig.onNext((val: number) => {
        assert.equal(false, true);
      });

      assert.equal(true, true);
    });

    it('should call given function with signal value on next value', function() {
      var count = 0;
      const sig = Signal.create(3);

      sig.onNext((val: number) => {
        assert.equal(count, 0);
        assert.equal(val, 1);
        count += 1;
      });

      Signal.push(sig, 1);
    });
  });

  describe('map', function() {
    it('should transform value on signal', function() {
      const sig = Signal.create<number>();
      const sig1 = sig.map((val) => val + 5);

      Signal.push(sig, 1);

      assert.equal(sig1.get(), 6);
    });
  });

  describe('filter', function() {
    it('should filter values on signal', function() {
      const sig = Signal.create<number>();
      const sig1 = sig.filter((val) => val > 5);

      Signal.push(sig, 1);
      Signal.push(sig, 8);
      Signal.push(sig, 3);

      assert.equal(sig1.get(), 8);
    });

    it('should block children from being updated', function() {
      const sig = Signal.create<number>();
      const sig1 = sig.filter((val) => val > 5);
      const sig2 = sig1.map((val) => val + 1);

      Signal.push(sig,9);
      Signal.push(sig,3);

      assert.equal(sig1.get(), 9);
      assert.equal(sig2.get(), 10);
    });
  });

  describe('fold', function() {
    it('should reduce values on a signal', function() {
      const sig = Signal.create<string>();
      const sig1 = sig.fold((acc, next) => acc + next, '');

      Signal.push(sig, 'h');
      Signal.push(sig, 'e');
      Signal.push(sig, 'l');
      Signal.push(sig, 'l');
      Signal.push(sig, 'o');

      assert.equal(sig1.get(), 'hello');
    });
  });

  describe('debounce', function() {
    it('should reduce values on a signal', function(done) {
      const sig = Signal.create();
      const sig1 = sig.debounce(20);
      const counter = sig1.fold((acc, next) => acc + 1, 0);

      sig1.onValue((val) => {
        assert.equal(val, 5);
        assert.equal(counter.get(), 1);
        done();
      });

      Signal.push(sig, 1);
      Signal.push(sig, 2);
      Signal.push(sig, 3);
      Signal.push(sig, 4);
      Signal.push(sig, 5);
    });
  });

  describe('dropRepeats', function() {
    it('should remove repeated values form signal', function() {
      const sig = Signal.create();
      const sig1 = sig.dropRepeats();
      const counter = sig1.fold((acc, next) => acc + 1, 0);

      Signal.push(sig, 1);
      Signal.push(sig, 1);
      Signal.push(sig, 1);

      assert.equal(counter.get(), 1);

      Signal.push(sig, 2);
      Signal.push(sig, 2);
      Signal.push(sig, 2);

      assert.equal(counter.get(), 2);

      Signal.push(sig, 3);

      assert.equal(counter.get(), 3);
    });
  });

  describe('merge', function() {
    it('should merge values from two signals', function() {
      const sig = Signal.create();
      const sig1 = Signal.create();
      const sig2 = sig.merge(sig1);

      Signal.push(sig, 1);
      assert.equal(sig2.get(), 1);

      Signal.push(sig, 2);
      assert.equal(sig2.get(), 2);

      Signal.push(sig1, 3);
      assert.equal(sig2.get(), 3);

      Signal.push(sig, 4);
      assert.equal(sig2.get(), 4);

      Signal.push(sig1, 5);
      assert.equal(sig2.get(), 5);
    });
  });
});