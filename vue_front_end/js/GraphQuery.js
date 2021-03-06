//初始化一个echarts实例
var fixed_chart = echarts.init(document.getElementById('fixed'));
//建立node_type到{property_name:property_content}的映射
var properties_map = new Map();
//控制知识图谱显示块的vue实例
vm = new Vue({
    el:"#GraphVue",
    data:{
        conditions: [ ],
        targets: [ ],
        table_data: [ ],
        label: "",
        all_properties: []
    },
    mounted: function(){
        this.DrawFixedGraph();
    },
    methods:{
        //Draw knowledge graph
        /**
         * 通过vue-resource插件异步加载数据，并调用GenerateFixedGraph可视化知识图谱
         * 
         */
        DrawFixedGraph: function(){
            //console.log(form_vue.$data.source_content);
            this.$http({
                method:"POST",
                url: "http://localhost:7474/db/data/transaction/commit",
                body: {
                        "statements" : [ {
                            "statement" : "match (a)-[r]->(b) return distinct labels(a),labels(b), type(r)"
                        } ]
                      },
                headers:{"Content-Type":"application/json","Authorization":"Basic bmVvNGo6cm9vdA=="},
            }).then(res=>{
                fixed_chart.showLoading();
                _fixed_chart = fixed_chart;
                processed_json = FixedDataProcessor(res.body);
                GenerateFixedGraph(processed_json,_fixed_chart);
                this.GetProperties(processed_json.nodes);
                //console.log(BuildCypher([{'type':'Brand','content':'condi'},{'type':'Model', 'content':' '},{'type':'Masterbrand', 'content':'condi'}],[{'type':'Dealer', 'content':' '}]));
            });
        },

        /**
         * 获取所有知识图谱节点的properties，并将映射存储到全局变量
         * 
         * @param {any} nodes 预处理后的图谱节点数据
         */
        GetProperties: function(nodes){
            let statements = [];
            for (let node of nodes){
                tmp_statement = {"statement" : "match (%s:%s) return keys(%s) limit 1".replace(/%s/g, node.name)};
                statements.push(tmp_statement);
            }
            properties_map.clear();
            this.$http({
                method:"POST",
                url: "http://localhost:7474/db/data/transaction/commit",
                body: {
                    "statements" : statements
                },
                headers:{"Content-Type":"application/json","Authorization":"Basic bmVvNGo6cm9vdA=="}
            }).then(res=>{
                for (let result of res.body.results){
                    let tmp_data = [];
                    let key = result.columns[0].substring(5, result.columns[0].length-1);
                    for (let property of result.data[0].row[0]){
                        tmp_data.push({"property":property});
                        this.all_properties.push({"property":property,"type":key});
                    }
                    
                    properties_map.set(key, tmp_data);
                }
            });
        },

        /**
         * 根据已选择的conditions和targets生成查询json的模版，并通过ace显示
         * 
         */
        GenerateTemplate: function(){
            let tmp_str = new String();
            let json_template = {};
            json_template['conditions'] = [];
            json_template['targets'] = [];
            for(let condition of this.conditions){
                console.log(condition);
                let tmp_con = {};
                tmp_con['type'] = condition;
                tmp_con['content'] = {}
                json_template['conditions'].push(tmp_con);
            }
            for(let target of this.targets){
                let tmp_con = {};
                tmp_con['type'] = target;
                tmp_con['content'] = {}
                json_template['targets'].push(tmp_con);
            }
            json_template['enable_graph'] = false;
            json_template['enable_like'] = false;
            //console.log(json_template);
            editor.setValue(JSON.stringify(json_template, null, '\t'));
        },

        /**
         * 将选中的查询条件从conditions里删除
         * 需要注意，这里的参数en是element封装好的事件参数，无法客制，所以获取选中条件的类型是通过在dom树中查找该输入框标签得到的
         * @param {any} en 
         */
        RemoveCondition: function(en){
            let index = this.conditions.indexOf(en.target.parentElement.children[0].innerText);
            this.conditions.splice(index, 1);
        },
        /**
         * 将选中的查询目标从targets中删除
         * 需要注意，这里的参数en是element封装好的事件参数，无法客制，所以获取选中目标的类型是通过在dom树中查找该输入框得到的
         * @param {any} en 
         */
        RemoveTarget: function(en){
            let index = this.targets.indexOf(en.target.parentElement.children[0].innerText);
            this.targets.splice(index, 1);
        }        
    }
});

/**
 * 将从neo4j查询到的原始数据格式化成echarts需求格式
 * 需要注意，该函数处理的是用来生成知识图谱的数据，不是查询数据
 * @param {any} rawjson 数据结构详见结构文档
 * @returns 
 */
function FixedDataProcessor(rawjson){
    let edges = new Array();
    let nodes = new Array();
    let node_set = new Set();
    rawjson.results["0"].data.forEach(function(relationship){
        //console.log(relationship.row[2]);
        new_edge = {
            "source":relationship.row[0][0],
            "target":relationship.row[1][0],
            "value":relationship.row[2]
        };
        node_set.add(relationship.row[0][0]);
        node_set.add(relationship.row[1][0]);
        edges.push(new_edge);
    });
    node_set.forEach(function(node){
        nodes.push({"name":node});
    });
    return {"nodes":nodes, "links":edges};
}

/**
 * 通过echarts绘制图谱，并利用echarts的graphic接口自定义选取控件
 * 
 * @param {any} knowledge 预处理成echarts格式的图谱数据
 * @param {any} _fixed_chart 在外部init的echarts实例
 */
function GenerateFixedGraph(knowledge,_fixed_chart){
    _fixed_chart.hideLoading();
    option = {
        title:{
            text: "Auto Knowledge Graph Query System"
        },
        //controll panel for choosing condition or target
        graphic:[
        {
            type: 'group',
            bounding: 'all',
            right: 50+70,
            top: 50,
            //invisible: true,
            children: [
                {
                    type: 'circle',
                    id: 'circle',
                    left: 'center',
                    top: 'center',
                    silent: true,
                    invisible: true,
                    shape: {
                        r: 50
                    },
                    style: {
                        fill: 'rgba(0,0,0,0.3)'
                    }
                },
                {
                    type: 'text',
                    id: 'text',
                    right: 'center',
                    top: 'center',
                    silent: true,
                    invisible: true,
                    style: {
                        fill: '#fff',
                        text: 'test',
                        textAlign: 'middle',
                        font: '13px Microsoft YaHei'
                    }
                },
                {
                    type:'sector',
                    id:'right_ring',
                    invisible: true,
                    shape:{
                        r: 70,
                        r0: 50,
                        startAngle:-Math.PI/2,
                        endAngle:Math.PI/2
                    },
                    left: '100%',
                    top: 'center',
                    style: {
                        fill:'#F0F8FF'
                    },
                    /**
                     * 当鼠标over右半圈时将右半圈变色
                     * 
                     */
                    onmouseover: function(){
                        _fixed_chart.setOption({
                            graphic:{
                                id: 'right_ring',
                                style: {
                                    fill: '#76eec6'
                                }
                            }
                        });
                    },
                    /**
                     * 当鼠标移出右半圈时将右半圈变色
                     * 
                     */
                    onmouseout: function(){
                        _fixed_chart.setOption({
                            graphic:{
                                id:'right_ring',
                                style: {
                                    fill: '#F0F8FF'
                                }
                            }
                        });
                    },
                    /**
                     * 鼠标点击右半圈时将选中目标压入vue的targets里，并隐藏选取控件
                     * 
                     */
                    onclick: function(){
                        vm.$data.targets.push(tmp_name);
                        _fixed_chart.setOption({
                            graphic: [
                                {
                                    id: 'left_ring',
                                    invisible: true,
                                },
                                {
                                    id: 'right_ring',
                                    invisible: true,
                                },
                                {
                                    id: 'text',
                                    invisible: true,
                                },
                                {
                                    id: 'circle',
                                    invisible: true
                                }
                            ]
                        });
                    }
            
                },
                {
                    type:'sector',
                    id:'left_ring',
                    invisible: true,
                    shape:{
                        r: 70,
                        r0: 50,
                        startAngle:Math.PI/2,
                        endAngle:Math.PI * 1.5
                    },
                    right: '50%',
                    top: 'center',
                    style: {
                        fill:'#F0F8FF'
                    },
                    /**
                     * 当鼠标over左半圈时将左半圈变色
                     * 
                     */
                    onmouseover: function(){
                        _fixed_chart.setOption({
                            graphic:{
                                id: 'left_ring',
                                style: {
                                    fill: '#76eec6'
                                }
                            }
                        });
                    },
                    /**
                     * 当鼠标移出左半圈时将左半圈变色
                     * 
                     */
                    onmouseout: function(){
                        _fixed_chart.setOption({
                            graphic:{
                                id:'left_ring',
                                style: {
                                    fill: '#F0F8FF'
                                }
                            }
                        });
                    },
                    /**
                     * 鼠标点击左半圈时，将选中节点压入vue的conditions里，并隐藏选取控件
                     * 
                     */
                    onclick: function(){
                        vm.$data.conditions.push(tmp_name);
                        _fixed_chart.setOption({
                            graphic: [
                                {
                                    id: 'left_ring',
                                    invisible: true,
                                },
                                {
                                    id: 'right_ring',
                                    invisible: true,
                                },
                                {
                                    id: 'text',
                                    invisible: true,
                                },
                                {
                                    id: 'circle',
                                    invisible: true
                                }
                            ]
                        });
                    }
                }]
            }],
            //Config for force graph
            series: [{
                type: 'graph',
                layout: 'force',
                symbolSize: 30,
                animation: true,
                label:{
                    normal: {
                        position: 'right',
                        formatter: '{b}',
                        show: true
                    }
                },
                edgeLabel: {
                normal: {
                    show: true,
                    textStyle: {
                        fontSize: 10
                    },
                    formatter: "{c}"
                    }
                },
                edgeSymbol: [null,'arrow'],
                draggable: true,
                data: knowledge.nodes,
                links: knowledge.links,
                //力引导布局效果主要靠以下参数调整
                force: {
                    edgeLength: 100,
                    repulsion: 400,
                    gravity: 0.01
                }
            }]
    };
    _fixed_chart.setOption(option);
    //点击节点，在图表中生成该节点对应类型及properties
    _fixed_chart.on('click', function(params){
        vm.$data.table_data = properties_map.get(params.data.name);
        vm.$data.label = params.data.name;
    });
    //双击节点显示选取控件
    _fixed_chart.on('dblclick', function (params) {
        tmp_name = params.data.name;
        _fixed_chart.setOption({
            graphic: [
                {
                    id: 'left_ring',
                    invisible: false,
                },
                {
                    id: 'right_ring',
                    invisible: false,
                },
                {
                    id: 'text',
                    invisible: false,
                    style: {
                        text: params.data.name
                    }
                },
                {
                    id: 'circle',
                    invisible: false
                }
            ]
        });
    });
}