# Gantt

A modern gantt widget based on [Frappe Gant](https://github.com/frappe/gantt)

### Why a new Gantt widget?
I was looking for a typescript first and good looking gantt widget for a project. After some search I tried Frappe Gantt that I found very good looking and simple to use.

The problem is that Frappe Gantt was not written in typescript, so types are not always aligned to the real. Moreover it was missing some functionality that I need ( ex: groups ) and have some bugs.

So I completely rewrite all the gantt, removing some "editing" functionality ( that I plan to reintroduce ), changing editing and other things to have a very simple and functional Gantt widget.


### How to use?
```javascript
const tasks: Task[] = [...]
const groups: TaskGroup[] = [...]
const options: Options = {};

// create the gantt using options, tasks and groups
const gantt = new Gantt('#id', tasks, options, groups);

// set view mode to "week" and center the gantt to today
// each time view mode is changed, gantt is rendered
gantt.changeViewMode('week', "today");
```