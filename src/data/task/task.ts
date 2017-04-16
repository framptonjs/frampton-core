import {
  immediate,
  isEqual,
  isFunction,
  noop,
  ofValue
} from '../../utils';


export interface TaskSinks<E,V,P> {
  reject(err?: E): void;
  resolve(val?: V): void;
  progress?: (prg?: P) => void;
}


export interface TaskComputation<E,V,P> {
  (sinks: TaskSinks<E,V,P>): void;
}


export type TaskMapping<A,B> =
  ((val: A) => B) |
  B;


export type TaskPredicate<T> =
  ((val: T) => boolean) |
  T;


export class Task<E,V,P> {
  _fn: TaskComputation<E,V,P>;

  constructor(computation: TaskComputation<E,V,P>) {
    this._fn = computation;
  }

  /**
   * Takes a hash of functions to call based on the resolution of the Task and runs the computation
   * contained within this Task.
   *
   * The sinks object should be of the form:
   * {
   *   reject : (err) => {},
   *   resolve : (val) => {},
   *   progress : (prog) => {}
   * }
   *
   * Each function is used by the contained computation to update us on the state of the running
   * computation.
   *
   * @name run
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Object} sinks
   * @param {Function} sinks.reject - The function to call on failure.
   * @param {Function} sinks.resolve - The function to call on success.
   * @param {Function} sinks.progress - The function to call on progress.
   */
  run(sinks: TaskSinks<E,V,P>): void {
    immediate(() => {
      try {
        this._fn(sinks);
      } catch(e) {
        sinks.reject(e);
      }
    });
  }

  /**
   * of(return) :: a -> Success a
   *
   * Returns a Task that always resolves with the given value.
   *
   * @name of
   * @method
   * @memberof Frampton.Data.Task#
   * @param {*} val - Value to resolve task with
   * @returns {Frampton.Data.Task}
   */
  of<T>(val: T): Task<never,T,never> {
    return new Task<never,T,never>((sinks: TaskSinks<never,T,never>): void => {
      sinks.resolve(val);
    });
  }

  /**
   * join :: Task x (Task x a) -> Task x a
   *
   * Takes a nested Task and removes one level of nesting.
   *
   * @name join
   * @method
   * @memberof Frampton.Data.Task#
   * @returns {Frampton.Data.Task}
   */
  join<B>(this: Task<E,Task<E,B,P>,P>): Task<E,B,P> {
    const source = this;
    return new Task<E,B,P>((sinks: TaskSinks<E,B,P>) => {
      source.run({
        reject: sinks.reject,
        resolve(val: Task<E,B,P>): void {
          val.run(sinks);
        },
        progress: noop
      });
    });
  }

  /**
   * concat(>>) :: Task x a -> Task x b -> Task x b
   *
   * Runs one task after another, discarding the return value of the first.
   *
   * @name concat
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Frampton.Data.Task} task - Task to run after this task
   * @returns {Frampton.Data.Task}
   */
  concat<B>(task: Task<E,B,P>): Task<E,B,P> {
    const source = this;
    return new Task<E,B,P>((sinks: TaskSinks<E,B,P>) => {
      source.run({
        reject: sinks.reject,
        resolve(val: V): void {
          task.run(sinks);
        },
        progress: noop
      });
    });
  }

  /**
   * chain(>>=) :: Task x a -> (a -> Task x b) -> Task x b
   *
   * Maps the return value of one Task to another Task, chaining two Tasks together.
   *
   * @name chain
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} mapping - Function to map the return value of this Task to another Task.
   * @returns {Frampton.Data.Task}
   */
  chain<B>(mapping: (val: V) => Task<E,B,P>): Task<E,B,P> {
    return this.map(mapping).join();
  }

  /**
   * ap(<*>) :: Task x (a -> b) -> Task x a -> Task x b
   *
   * @name ap
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Frampton.Data.Task} task
   * @returns {Frampton.Data.Task}
   */
  ap<A,B>(this: Task<E,(a: A) => B,P>, task: Task<E,A,P>): Task<E,B,P> {
    return this.chain((fn) => {
      return task.map(fn);
    });
  }

  /**
   * recover :: Task x a -> (x -> b) -> Task x b
   *
   * Used to map a reject to a resolve.
   *
   * @name recover
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} mapping
   * @returns {Frampton.Data.Task}
   */
  recover(mapping: TaskMapping<E,V>): Task<E,V,P> {
    const source = this;
    const mappingFn: (val: E) => V =
      (typeof mapping === 'function') ?
        mapping :
        ofValue(mapping);

    return new Task((sinks: TaskSinks<E,V,P>) => {
      source.run({
        reject(err: E): void {
          sinks.resolve(mappingFn(err));
        },
        resolve: sinks.resolve,
        progress: sinks.progress
      });
    });
  }

  /**
   * default :: Task x a -> b -> Task x b
   *
   * Returns the given value as a resolve in case of a reject.
   *
   * @name default
   * @method
   * @memberof Frampton.Data.Task#
   * @param {*} val - A value to map errors to
   * @returns {Frampton.Data.Task}
   */
  default(val: V): Task<E,V,P> {
    return this.recover(() => val);
  }

  /**
   * progress :: Task x a -> (a -> b) -> Task x b
   *
   * Maps progress branch to resolution branch
   *
   * @name progress
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} mapping
   * @returns {Frampton.Data.Task}
   */
  progress(mapping: TaskMapping<P,V>): Task<E,V,P> {
    const source = this;
    const mappingFn: (val: P) => V =
      (typeof mapping === 'function') ?
        mapping :
        ofValue(mapping);

    return new Task((sinks: TaskSinks<E,V,P>) => {
      source.run({
        reject: sinks.reject,
        resolve: sinks.resolve,
        progress(val: P): void {
          sinks.resolve(mappingFn(val));
        }
      });
    });
  }

  /**
   * map :: Task x a -> (a -> b) -> Task x b
   *
   * @name map
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} mapping
   * @returns {Frampton.Data.Task}
   */
  map<B>(mapping: TaskMapping<V,B>): Task<E,B,P> {
    const source = this;
    const mappingFn: (val: V) => B =
      (typeof mapping === 'function') ?
        mapping :
        ofValue(mapping);

    return new Task((sinks: TaskSinks<E,B,P>) => {
      source.run({
        reject: sinks.reject,
        resolve(val: V): void {
          sinks.resolve(mappingFn(val));
        },
        progress: sinks.progress
      });
    });
  }

  /**
   * success :: Task x a -> (a -> b) -> Task x b
   *
   * A symantic alias for Task.prototype.map
   *
   * @name success
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} mapping - The function to map the resolve value.
   * @returns {Frampton.Data.Task}
   */
  success<B>(mapping: TaskMapping<V,B>) {
    return this.map(mapping);
  }

  /**
   * filter :: Task x a -> (a -> b) -> Task x b
   *
   * @name filter
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} predicate - The function to filter the resolve value.
   * @returns {Frampton.Data.Task}
   */
  filter(predicate: TaskPredicate<V>): Task<E,V,P> {
    const source = this;
    const filterFn: (val: V) => boolean =
      (typeof predicate === 'function') ?
        predicate :
        isEqual(predicate);

    return new Task((sinks: TaskSinks<E,V,P>) => {
      source.run({
        reject: sinks.reject,
        resolve(val: V): void {
          if (filterFn(val)) {
            sinks.resolve(val);
          } else {
            sinks.reject(null);
          }
        },
        progress: sinks.progress
      });
    });
  }

  /**
   * validate :: Task x a -> (a -> b) -> Task x b
   *
   * A symantic alias for filter. Used to validate the return value of a Task. It the given
   * predicate returns false a resolve is turned into a reject.
   *
   * @name validate
   * @method
   * @memberof Frampton.Data.Task#
   * @param {Function} predicate - The function to validate the resolve value.
   * @returns {Frampton.Data.Task}
   */
  validate(predicate: TaskPredicate<V>): Task<E,V,P> {
    return this.filter(predicate);
  }
}


/**
 * Method for creating new Tasks. This method should be used instead of calling the Task
 * constructor directly.
 *
 * @name create
 * @method
 * @memberof Frampton.Data.Task
 * @param {Function} computation - The function the Task should execute
 * @returns {Frampton.Data.Task}
 */
export function create<E,V,P>(computation: TaskComputation<E,V,P>): Task<E,V,P> {
  return new Task(computation);
}